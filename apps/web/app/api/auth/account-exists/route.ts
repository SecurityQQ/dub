import { isWhitelistedEmail } from "@/lib/edge-config";
import { DATABASE_URL, supabase } from "@/lib/planetscale";
import { ratelimit } from "@/lib/upstash";
import { ipAddress } from "@vercel/edge";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const ip = ipAddress(req);
  const { success } = await ratelimit(5, "1 m").limit(`account-exists:${ip}`);
  if (!success) {
    return new Response("Don't DDoS me pls 🥺", { status: 429 });
  }

  const { email } = (await req.json()) as { email: string };

  if (!DATABASE_URL) {
    return new Response("Database connection not established", {
      status: 500,
    });
  }

  if (!process.env.NEXT_PUBLIC_IS_DUB) {
    return NextResponse.json({ exists: true });
  }

  const { data, error } = await supabase
    .from('User')
    .select('email')
    .eq('email', email)
    .single();  // Assuming you are expecting only one record back

  if (error) {
      console.error('Error fetching user:', error.message);
      return new Response("Database error", {
      status: 500,
    });
  }

  const user = data;

  if (user) {
    return NextResponse.json({ exists: true });
  }

  const whitelisted = await isWhitelistedEmail(email);
  if (whitelisted) {
    return NextResponse.json({ exists: true });
  }

  return NextResponse.json({ exists: false });
}
