import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  const { publicId } = await context.params;
  if (request.headers.get("sec-fetch-site") === "cross-site" || !/^[0-9a-f-]{36}$/i.test(publicId)) return Response.json({ error: { message: "삭제할 코스를 다시 확인해 주세요." } }, { status: 403, headers });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: { message: "로그인 후 삭제할 수 있어요." } }, { status: 401, headers });
  const { data, error } = await supabase.from("courses").delete().eq("public_id", publicId).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return Response.json({ error: { message: "코스를 삭제하지 못했어요." } }, { status: error ? 422 : 404, headers });
  return Response.json({ data: { publicId } }, { headers });
}
