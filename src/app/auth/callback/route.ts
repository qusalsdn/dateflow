import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const destination = new URL(next?.startsWith("/") ? next : "/", url.origin);
  if (!code) {
    destination.searchParams.set("auth_error", "1");
    return NextResponse.redirect(destination);
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) destination.searchParams.set("auth_error", "1");
  } catch {
    destination.searchParams.set("auth_error", "1");
  }
  return NextResponse.redirect(destination);
}
