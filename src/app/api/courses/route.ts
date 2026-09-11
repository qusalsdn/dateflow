import { collectNearbyCandidates } from "@/lib/course/candidates";
import { CourseConditionError, parseCourseConditions } from "@/lib/course/conditions";
import { generateCourse } from "@/lib/course/generate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new CourseConditionError("CROSS_SITE_REQUEST", "이 화면에서 다시 시도해 주세요.");
    const parsed = parseCourseConditions(await request.json());
    const course = generateCourse(parsed, await collectNearbyCandidates(parsed.place));
    return Response.json({ data: course }, { headers });
  } catch (error) {
    const message = error instanceof CourseConditionError ? error.message : error instanceof Error ? error.message : "코스를 만들지 못했어요. 다시 시도해 주세요.";
    return Response.json({ error: { message } }, { status: error instanceof CourseConditionError && error.code === "CROSS_SITE_REQUEST" ? 403 : 422, headers });
  }
}
