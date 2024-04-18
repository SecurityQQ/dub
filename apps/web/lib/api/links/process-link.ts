import { isBlacklistedDomain, updateConfig } from "@/lib/edge-config";
import { getPangeaDomainIntel } from "@/lib/pangea";
import { checkIfUserExists, getRandomKey } from "@/lib/planetscale";
import prisma from "@/lib/prisma";
import { LinkWithTagIdsProps, WorkspaceProps } from "@/lib/types";
import {
  DUB_DOMAINS,
  SHORT_DOMAIN,
  getApexDomain,
  getDomainWithoutWWW,
  getUrlFromString,
  isDubDomain,
  isValidUrl,
  log,
  parseDateTime,
} from "@dub/utils";
import { combineTagIds, keyChecks, processKey } from "./utils";

export async function processLink({
  payload,
  workspace,
  userId,
  bulk = false,
  skipKeyChecks = false, // only skip when key doesn't change (e.g. when editing a link)
}: {
  payload: LinkWithTagIdsProps;
  workspace?: WorkspaceProps;
  userId?: string;
  bulk?: boolean;
  skipKeyChecks?: boolean;
}) {
  let {
    domain,
    key,
    url,
    image,
    proxy,
    password,
    rewrite,
    expiresAt,
    expiredUrl,
    ios,
    android,
    geo,
    createdAt,
  } = payload;

  const tagIds = combineTagIds(payload);

  // url checks
  if (!url) {
    return {
      link: payload,
      error: "Missing destination url.",
      code: "bad_request",
    };
  }
  url = getUrlFromString(url);
  if (!isValidUrl(url)) {
    return {
      link: payload,
      error: "Invalid destination url.",
      code: "unprocessable_entity",
    };
  }

  // free plan restrictions (after Jan 19, 2024)
  if (
    (!workspace || workspace.plan === "free") &&
    (!createdAt || new Date(createdAt) > new Date("2024-01-19"))
  ) {
    if (proxy || password || rewrite || expiresAt || ios || android || geo) {
      const proFeaturesString = [
        proxy && "custom social media cards",
        password && "password protection",
        rewrite && "link cloaking",
        expiresAt && "link expiration",
        ios && "iOS targeting",
        android && "Android targeting",
        geo && "geo targeting",
      ]
        .filter(Boolean)
        .join(", ")
        // final one should be "and" instead of comma
        .replace(/, ([^,]*)$/, " and $1");

      return {
        link: payload,
        error: `You can only use ${proFeaturesString} on a Pro plan and above. Upgrade to Pro to use these features.`,
        code: "forbidden",
      };
    }
  }

  // if domain is not defined, set it to the workspace's primary domain
  if (!domain) {
    domain = workspace?.domains?.find((d) => d.primary)?.slug || SHORT_DOMAIN;
  }

  // checks for dub.sh links
  if (domain === "dub.sh") {
    // check if user exists (if userId is passed)
    if (userId) {
      const userExists = await checkIfUserExists(userId);
      if (!userExists) {
        return {
          link: payload,
          error: "Session expired. Please log in again.",
          code: "not_found",
        };
      }
    }

    const isMaliciousLink = await maliciousLinkCheck(url);
    if (isMaliciousLink) {
      return {
        link: payload,
        error: "Malicious URL detected",
        code: "unprocessable_entity",
      };
    }

    // checks for other Dub-owned domains (chatg.pt, spti.fi, etc.)
  } else if (isDubDomain(domain)) {
    // coerce type with ! cause we already checked if it exists
    const { allowedHostnames } = DUB_DOMAINS.find((d) => d.slug === domain)!;
    const urlDomain = getDomainWithoutWWW(url) || "";
    if (allowedHostnames && Array.isArray(allowedHostnames) && allowedHostnames.length > 0 && !allowedHostnames.includes(urlDomain)) {
      return {
        link: payload,
        error: `Invalid url. You can only use ${domain} short links for URLs starting with ${allowedHostnames
          .map((d) => `\`${d}\``)
          .join(", ")}.`,
        code: "unprocessable_entity",
      };
    }

    // else, check if the domain belongs to the workspace
  } else if (!workspace?.domains?.find((d) => d.slug === domain)) {
    return {
      link: payload,
      error: "Domain does not belong to workspace.",
      code: "forbidden",
    };
  }

  if (!key) {
    key = await getRandomKey({
      domain,
      prefix: payload["prefix"],
      long: domain === "loooooooo.ng",
    });
  } else if (!skipKeyChecks) {
    const processedKey = processKey(key);
    if (processedKey === null) {
      return {
        link: payload,
        error: "Invalid key.",
        code: "unprocessable_entity",
      };
    }
    key = processedKey;

    const response = await keyChecks({ domain, key, workspace });
    if (response.error) {
      return {
        link: payload,
        ...response,
      };
    }
  }

  if (bulk) {
    if (image) {
      return {
        link: payload,
        error: "You cannot set custom social cards with bulk link creation.",
        code: "unprocessable_entity",
      };
    }
    if (rewrite) {
      return {
        link: payload,
        error: "You cannot use link cloaking with bulk link creation.",
        code: "unprocessable_entity",
      };
    }

    // only perform tag validity checks if:
    // - not bulk creation (we do that check separately in the route itself)
    // - tagIds are present
  } else if (tagIds.length > 0) {
    const tags = await prisma.tag.findMany({
      select: {
        id: true,
      },
      where: { projectId: workspace?.id, id: { in: tagIds } },
    });

    if (tags.length !== tagIds.length) {
      return {
        link: payload,
        error:
          "Invalid tagIds detected: " +
          tagIds
            .filter(
              (tagId) => tags.find(({ id }) => tagId === id) === undefined,
            )
            .join(", "),
        code: "unprocessable_entity",
      };
    }
  }

  // custom social media image checks (see if R2 is configured)
  if (proxy && !process.env.STORAGE_SECRET_ACCESS_KEY) {
    return {
      link: payload,
      error: "Missing storage access key.",
      code: "bad_request",
    };
  }

  // expire date checks
  if (expiresAt) {
    const datetime = parseDateTime(expiresAt);
    if (!datetime) {
      return {
        link: payload,
        error: "Invalid expiration date.",
        code: "unprocessable_entity",
      };
    }
    expiresAt = datetime;
    if (expiredUrl) {
      expiredUrl = getUrlFromString(expiredUrl);
      if (!isValidUrl(expiredUrl)) {
        return {
          link: payload,
          error: "Invalid expired URL.",
          code: "unprocessable_entity",
        };
      }
    }
  }

  // remove polyfill attributes from payload
  delete payload["shortLink"];
  delete payload["qrCode"];
  delete payload["prefix"];

  return {
    link: {
      ...payload,
      domain,
      key,
      // we're redefining these fields because they're processed in the function
      url,
      expiresAt,
      expiredUrl,
      // make sure projectId is set to the current workspace
      projectId: workspace?.id || null,
      // if userId is passed, set it (we don't change the userId if it's already set, e.g. when editing a link)
      ...(userId && {
        userId,
      }),
    },
    error: null,
  };
}

async function maliciousLinkCheck(url: string) {
  const [domain, apexDomain] = [getDomainWithoutWWW(url), getApexDomain(url)];

  if (!domain) {
    return false;
  }

  const domainBlacklisted = await isBlacklistedDomain({ domain, apexDomain });
  if (domainBlacklisted === true) {
    return true;
  } else if (domainBlacklisted === "whitelisted") {
    return false;
  }

  try {
    const response = await getPangeaDomainIntel(domain);

    const verdict = response.result.data[apexDomain].verdict;
    console.log("Pangea verdict for domain", apexDomain, verdict);

    if (verdict === "benign") {
      await updateConfig({
        key: "whitelistedDomains",
        value: domain,
      });
      return false;
    } else if (verdict === "malicious" || verdict === "suspicious") {
      await Promise.all([
        updateConfig({
          key: "domains",
          value: domain,
        }),
        log({
          message: `Suspicious link detected via Pangea → ${url}`,
          type: "links",
          mention: true,
        }),
      ]);

      return true;
    }
  } catch (e) {
    console.error("Error checking domain with Pangea", e);
  }

  return false;
}
