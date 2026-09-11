import { collectNearbyCandidates } from "@/lib/course/candidates";
import { CourseConditionError, parseCourseConditions, parseCoursePlace } from "@/lib/course/conditions";
import { replaceCourseStop } from "@/lib/course/generate";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new CourseConditionError("CROSS_SITE_REQUEST", "이 화면에서 다시 시도해 주세요.");
    const body: unknown = await request.json();
    if (!isRecord(body) || !isRecord(body.course) || typeof body.stopId !== "string" || !/^\d{1,30}$/.test(body.stopId)) {
      throw new CourseConditionError("INVALID_INPUT", "바꿀 장소를 다시 선택해 주세요.");
    }
    const parsed = parseCourseConditions({ place: body.course.requiredPlace, conditions: body.course.conditions });
    if (!Array.isArray(body.course.stops)) throw new CourseConditionError("INVALID_INPUT", "현재 코스를 다시 확인해 주세요.");
    const currentPlaces = body.course.stops
      .filter((stop): stop is Record<string, unknown> => isRecord(stop) && stop.kind === "place")
      .map((stop) => parseCoursePlace({ id: stop.id, name: stop.name, category: stop.category, address: stop.address, roadAddress: stop.address, latitude: stop.latitude, longitude: stop.longitude }, "코스 장소"));
    if (currentPlaces.length < 3 || currentPlaces.length > 4 || currentPlaces[0]?.id !== parsed.place.id || !currentPlaces.some((place) => place.id === body.stopId)) {
      throw new CourseConditionError("INVALID_INPUT", "현재 코스를 다시 확인해 주세요.");
    }
    const course = replaceCourseStop(parsed, currentPlaces, body.stopId, await collectNearbyCandidates(parsed.place));
    return Response.json({ data: course }, { headers });
  } catch (error) {
    const message = error instanceof CourseConditionError ? error.message : error instanceof Error ? error.message : "장소를 바꾸지 못했어요. 다시 시도해 주세요.";
    return Response.json({ error: { message } }, { status: error instanceof CourseConditionError && error.code === "CROSS_SITE_REQUEST" ? 403 : 422, headers });
  }
}
