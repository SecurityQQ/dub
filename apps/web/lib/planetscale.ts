import { nanoid, punyEncode } from "@dub/utils";
import { Pool } from 'pg';
import { DomainProps, WorkspaceProps } from "./types";

export const DATABASE_URL = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const queryDatabase = async (query: string, params: any[]) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(query, params);
    return rows;
  } finally {
    client.release();
  }
};

export const getWorkspaceViaEdge = async (workspaceId: string) => {
  const rows = await queryDatabase("SELECT * FROM Project WHERE id = $1", [workspaceId.replace("ws_", "")]);
  return rows.length > 0 ? (rows[0] as WorkspaceProps) : null;
};

export const getDomainViaEdge = async (domain: string) => {
  const rows = await queryDatabase("SELECT * FROM Domain WHERE slug = $1", [domain]);
  return rows.length > 0 ? (rows[0] as DomainProps) : null;
};

export const checkIfKeyExists = async (domain: string, key: string) => {
  const rows = await queryDatabase("SELECT 1 FROM Link WHERE domain = $1 AND key = $2 LIMIT 1", [domain, punyEncode(decodeURIComponent(key))]);
  return rows.length > 0;
};

export const checkIfUserExists = async (userId: string) => {
  const rows = await queryDatabase("SELECT 1 FROM User WHERE id = $1 LIMIT 1", [userId]);
  return rows.length > 0;
};

export const getLinkViaEdge = async (domain: string, key: string) => {
  const rows = await queryDatabase("SELECT * FROM Link WHERE domain = $1 AND key = $2", [domain, punyEncode(decodeURIComponent(key))]);
  return rows.length > 0 ? rows[0] as {
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
  } : null;
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
