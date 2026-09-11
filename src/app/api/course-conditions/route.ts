import { CourseConditionError, parseCourseConditions } from "@/lib/course/conditions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new CourseConditionError("CROSS_SITE_REQUEST", "이 화면에서 조건을 다시 확인해 주세요.");
    }
    const payload: unknown = await request.json();
    return Response.json({ data: parseCourseConditions(payload) }, { headers });
  } catch (error) {
    const failure = error instanceof CourseConditionError
      ? error
      : new CourseConditionError("INVALID_INPUT", "입력한 조건을 다시 확인해 주세요.");
    const status = failure.code === "CROSS_SITE_REQUEST" ? 403 : 400;
    return Response.json({ error: { code: failure.code, message: failure.message } }, { status, headers });
  }
}
