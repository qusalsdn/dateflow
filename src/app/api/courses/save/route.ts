import { CourseConditionError } from "@/lib/course/conditions";
import { courseTitle, parseSavedCourse } from "@/lib/course/persistence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function databaseMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "PGRST205") {
    return "저장 기능의 데이터베이스 준비가 아직 끝나지 않았어요. courses 마이그레이션을 먼저 적용해 주세요.";
  }
  return "저장 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new CourseConditionError("CROSS_SITE_REQUEST", "이 화면에서 다시 시도해 주세요.");
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: { message: "코스를 저장하려면 카카오 로그인이 필요해요.", code: "UNAUTHENTICATED" } }, { status: 401, headers });
    const course = parseSavedCourse((await request.json() as { course?: unknown }).course);
    const { data, error } = await supabase.from("courses").insert({ user_id: user.id, title: courseTitle(course), course_data: course }).select("id, public_id, created_at").single();
    if (error) throw new Error(databaseMessage(error));
    return Response.json({ data: { id: data.id, publicId: data.public_id, createdAt: data.created_at } }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof CourseConditionError ? error.message : error instanceof Error ? error.message : "코스를 저장하지 못했어요. 다시 시도해 주세요.";
    return Response.json({ error: { message } }, { status: 422, headers });
  }
}
