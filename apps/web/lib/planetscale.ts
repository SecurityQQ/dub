import { nanoid, punyEncode } from "@dub/utils";
import { DomainProps, WorkspaceProps } from "./types";
import { createClient } from '@supabase/supabase-js';


export const DATABASE_URL = process.env.DATABASE_URL;



const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;  // Use the appropriate key that has the required permissions

export const supabase = createClient(supabaseUrl, supabaseKey);


export const queryDatabase = async (table, match) => {
  let { data, error } = await supabase
    .from(table)
    .select('*')
    .match(match);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
}

export const getWorkspaceViaEdge = async (workspaceId) => {
  const data = await queryDatabase('Project', { id: workspaceId.replace("ws_", "") });
  return data.length > 0 ? data[0] : null;
};

export const getDomainViaEdge = async (domain) => {
  const data = await queryDatabase('Domain', { slug: domain });
  return data.length > 0 ? data[0] : null;
};

export const checkIfKeyExists = async (domain, key) => {
  const data = await queryDatabase('Link', { domain: domain, key: punyEncode(decodeURIComponent(key)) });
  return data.length > 0;
};

export const checkIfUserExists = async (userId) => {
  const data = await queryDatabase('User', { id: userId });
  return data.length > 0;
};

export const getLinkViaEdge = async (domain, key) => {
  const data = await queryDatabase('Link', { domain: domain, key: punyEncode(decodeURIComponent(key)) });
  return data.length > 0 ? data[0] : null;
};

export async function getDomainOrLink({ domain, key }) {
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

export async function getRandomKey({ domain, prefix, long }) {
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

