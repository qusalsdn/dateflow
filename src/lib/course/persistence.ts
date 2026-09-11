import "server-only";
import { CourseConditionError, parseCourseConditions, parseCoursePlace } from "@/lib/course/conditions";
import type { GeneratedCourse } from "@/lib/course/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTime(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/** Validates a client-submitted snapshot before it can become a saved course. */
export function parseSavedCourse(value: unknown): GeneratedCourse {
  if (!isRecord(value) || !Array.isArray(value.stops)) throw new CourseConditionError("INVALID_INPUT", "저장할 코스를 다시 확인해 주세요.");
  const request = parseCourseConditions({ place: value.requiredPlace, conditions: value.conditions });
  if (value.date !== request.conditions.date || value.budget !== request.conditions.budget || value.candidateSource !== "kakao" || value.hasEstimatedTravel !== true) {
    throw new CourseConditionError("INVALID_INPUT", "저장할 코스를 다시 확인해 주세요.");
  }
  const places = value.stops.filter((stop): stop is Record<string, unknown> => isRecord(stop) && stop.kind === "place");
  if (places.length < 3 || places.length > 4 || places[0]?.id !== request.place.id) throw new CourseConditionError("INVALID_INPUT", "저장할 코스를 다시 확인해 주세요.");
  const seen = new Set<string>();
  for (const stop of value.stops) {
    if (!isRecord(stop) || (stop.kind !== "place" && stop.kind !== "fixed_schedule") || typeof stop.id !== "string" || typeof stop.name !== "string" || !isTime(stop.startTime) || !isTime(stop.endTime) || typeof stop.stayMinutes !== "number" || stop.stayMinutes < 0 || !isRecord(stop.travelFromPrevious) && stop.travelFromPrevious !== null) {
      throw new CourseConditionError("INVALID_INPUT", "저장할 코스를 다시 확인해 주세요.");
    }
    if (stop.kind === "place") {
      const place = parseCoursePlace({ id: stop.id, name: stop.name, category: stop.category, address: stop.address, roadAddress: stop.address, latitude: stop.latitude, longitude: stop.longitude }, "코스 장소");
      if (seen.has(place.id)) throw new CourseConditionError("INVALID_INPUT", "저장할 코스를 다시 확인해 주세요.");
      seen.add(place.id);
    }
  }
  return value as GeneratedCourse;
}

export function courseTitle(course: GeneratedCourse) {
  return `${course.requiredPlace.name}에서 시작하는 코스`;
}
