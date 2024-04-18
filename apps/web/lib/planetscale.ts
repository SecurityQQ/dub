import { nanoid, punyEncode } from "@dub/utils";
import { DomainProps, WorkspaceProps } from "./types";
import { createClient } from '@supabase/supabase-js';


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);


export const queryDatabase = async (table, match) => {
  let { data, error } = await supabase
    .from(table)
    .select('*')
    .match(match);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
}

export const getWorkspaceViaEdge = async (workspaceId: string) => {
  const data = await queryDatabase('Project', { id: workspaceId.replace("ws_", "") });
  return data && Array.isArray(data) && data.length > 0 ? (data[0] as WorkspaceProps) : null;
};

export const getDomainViaEdge = async (domain: string) => {
  const data = await queryDatabase('Domain', { slug: domain });
  return data && Array.isArray(data) && data.length > 0 ? (data[0] as DomainProps) : null;
};

export const checkIfKeyExists = async (domain: string, key: string) => {
  const data = await queryDatabase('Link', { domain: domain, key: punyEncode(decodeURIComponent(key)) });
  return data && Array.isArray(data) && data.length > 0;
};

export const checkIfUserExists = async (userId: string) => {
  const data = await queryDatabase('User', { id: userId });
  return data && Array.isArray(data) && data.length > 0;
};

export const getLinkViaEdge = async (domain: string, key: string) => {
  const data = await queryDatabase('Link', { domain: domain, key: punyEncode(decodeURIComponent(key)) });
  return data && Array.isArray(data) && data.length > 0 ? (data[0] as {
        id: string;
        domain: string;
        key: string;
        url: string;
        proxy: number;
        title: string;
        description: string;
        image: string;
        rewrite: number;
        password: string | null;
        expiresAt: string | null;
        ios: string | null;
        android: string | null;
        geo: object | null;
        projectId: string;
        publicStats: number;
      }): null;
};

export async function getDomainOrLink({
  domain,
  key,
}: {
  domain: string;
  key?: string;
}) {
  if (!key || key === "_root") {
    const data = await getDomainViaEdge(domain);
    if (!data) return null;
    return {
      ...data,
      key: "_root",
      url: data?.target,
    };
  } else {
    return await getLinkViaEdge(domain, key);
  }
}

export async function getRandomKey({
  domain,
  prefix,
  long,
}: {
  domain: string;
  prefix?: string;
  long?: boolean;
}): Promise<string> {
  let key = long ? nanoid(69) : nanoid();
  if (prefix) {
    key = `${prefix.replace(/^\/|\/$/g, "")}/${key}`;
  }
  const exists = await checkIfKeyExists(domain, key);
  if (exists) {
    return getRandomKey({ domain, prefix, long });
  } else {
    return key;
  }
}

