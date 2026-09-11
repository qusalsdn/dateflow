import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function setVisibility(request: Request, context: { params: Promise<{ publicId: string }> }, isShared: boolean) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  const { publicId } = await context.params;
  if (request.headers.get("sec-fetch-site") === "cross-site" || !/^[0-9a-f-]{36}$/i.test(publicId)) return Response.json({ error: { message: "공유할 코스를 다시 확인해 주세요." } }, { status: 403, headers });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: { message: "로그인 후 공유할 수 있어요." } }, { status: 401, headers });
  const { data, error } = await supabase.from("courses").update({ is_shared: isShared }).eq("public_id", publicId).eq("user_id", user.id).select("public_id, is_shared").maybeSingle();
  if (error || !data) return Response.json({ error: { message: "공개 상태를 바꾸지 못했어요." } }, { status: error ? 422 : 404, headers });
  return Response.json({ data: { publicId: data.public_id, isShared: data.is_shared } }, { headers });
}

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  return setVisibility(request, context, true);
}

export async function PATCH(request: Request, context: { params: Promise<{ publicId: string }> }) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: { message: "공개 상태를 다시 선택해 주세요." } }, { status: 422 }); }
  if (typeof body !== "object" || body === null || !("isShared" in body) || typeof body.isShared !== "boolean") return Response.json({ error: { message: "공개 상태를 다시 선택해 주세요." } }, { status: 422 });
  return setVisibility(request, context, body.isShared);
}
