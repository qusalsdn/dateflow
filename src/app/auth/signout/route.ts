import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const destination = new URL("/", request.url);
  if (request.headers.get("sec-fetch-site") !== "cross-site") {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(destination, 303);
}
