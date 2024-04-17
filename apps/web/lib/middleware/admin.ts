import { parse } from "@/lib/middleware/utils";
import { DUB_WORKSPACE_ID } from "@dub/utils";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "../planetscale";
import { UserProps } from "../types";

export default async function AdminMiddleware(req: NextRequest) {
  const { path } = parse(req);
  let isAdmin = false;

  const session = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as {
    id?: string;
    email?: string;
    user?: UserProps;
  };

  if (!session?.user?.id) {
    // Handle the case where there is no user session
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const { data, error } = await supabase
    .from('ProjectUsers')
    .select('projectId')
    .eq('userId', session.user.id)
    .single();

  if (error) {
    console.error('Error fetching project ID:', error.message);
    return NextResponse.redirect(new URL('/login', req.url)); // Redirect or handle error as needed
  }

  if (data?.projectId === DUB_WORKSPACE_ID) {
    isAdmin = true;
  }

  if (path === "/login" && isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  } else if (path !== "/login" && !isAdmin) {
    return NextResponse.redirect(new URL(`/login`, req.url));
  }

  return NextResponse.rewrite(
    new URL(`/admin.dub.co${path === "/" ? "" : path}`, req.url),
  );
}
