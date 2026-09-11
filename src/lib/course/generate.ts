import "server-only";

import { SERVICE_CONFIG } from "../config";
import type { Place } from "../places/types";
import type { CourseStop, GeneratedCourse, TransportMode, ValidatedCourseRequest } from "./types";

const minuteOf = (time: string) => { const [hour, minute] = time.split(":").map(Number); return hour * 60 + minute; };
const timeOf = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

function distance(a: Place, b: Place) {
  const radians = Math.PI / 180;
  const lat = (b.latitude - a.latitude) * radians;
  const lng = (b.longitude - a.longitude) * radians;
  const value = Math.sin(lat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lng / 2) ** 2;
  return 6371_000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function travel(a: Place, b: Place, modes: TransportMode[]) {
  const meters = Math.round(distance(a, b) / 10) * 10;
  const walking = Math.max(4, Math.ceil(meters / 75));
  const transit = Math.max(12, Math.ceil(meters / 260) + 8);
  const mode: TransportMode = modes.includes("walking") && (!modes.includes("public_transit") || walking <= transit) ? "walking" : "public_transit";
  return { minutes: mode === "walking" ? walking : transit, distanceMeters: meters, mode, isEstimate: true as const };
}

function estimateCost(place: Place) {
  if (/공원|전시|미술|박물|문화/u.test(place.category)) return 8_000;
  if (/카페|커피/u.test(place.category)) return 16_000;
  return 40_000;
}

function activityType(place: Place) {
  const text = `${place.category} ${place.name}`;
  if (/카페|커피|디저트|베이커리/u.test(text)) return "cafe";
  if (/음식|식당|레스토랑|맛집|주점|바|술/u.test(text)) return "restaurant";
  if (/공원|산책|한강|수목원/u.test(text)) return "park";
  if (/전시|미술|박물|공연|문화|갤러리/u.test(text)) return "culture";
  return "other";
}

function isSameKindOfOuting(anchor: Place, candidate: Place) {
  const anchorType = activityType(anchor);
  return (anchorType === "park" || anchorType === "culture") && activityType(candidate) === anchorType;
}

function tooClose(a: Place, b: Place, minimumMeters = 180) {
  return distance(a, b) < minimumMeters;
}

function chooseCandidates(anchor: Place, candidates: Place[], count: number, budget: number) {
  const picked: Place[] = [];
  const usedCategories = new Set([activityType(anchor)]);
  let current = anchor;
  while (picked.length < count) {
    const remaining = candidates.filter((candidate) => candidate.id !== anchor.id
      && !picked.some((place) => place.id === candidate.id)
      // A park or exhibition selected by the user is the destination already.
      // Do not fill the rest of that date with more entries of the same kind.
      && !isSameKindOfOuting(anchor, candidate)
      // A separate destination should not be another facility in the same park
      // or the shop directly next door.  The lower value still works in dense
      // commercial streets while eliminating the 0.1 km duplicate shown here.
      && !tooClose(anchor, candidate)
      && !picked.some((place) => tooClose(place, candidate)));
    if (!remaining.length) break;
    const next = remaining.sort((a, b) => score(b, current, usedCategories, budget) - score(a, current, usedCategories, budget))[0];
    picked.push(next); usedCategories.add(activityType(next)); current = next;
  }
  return picked;
}

function score(candidate: Place, current: Place, usedCategories: Set<string>, budget: number) {
  // Prefer a short, meaningful leg over a near-zero leg; the latter commonly
  // represents an amenity inside the selected venue rather than a next stop.
  const distanceScore = Math.max(0, 38 - Math.abs(distance(current, candidate) - 850) / 80);
  const diversity = usedCategories.has(activityType(candidate)) ? 0 : 28;
  const budgetScore = budget === 0 || estimateCost(candidate) <= budget / 2 ? 8 : -18;
  return distanceScore + diversity + budgetScore;
}

function buildCourse(request: ValidatedCourseRequest, places: Place[]): GeneratedCourse {
  const { place, conditions } = request;
  const totalWindow = minuteOf(conditions.endTime) - minuteOf(conditions.startTime);
  const fixedMinutes = conditions.fixedSchedule ? minuteOf(conditions.fixedSchedule.endTime) - minuteOf(conditions.fixedSchedule.startTime) : 0;
  const available = totalWindow - fixedMinutes;
  const travelLegs = places.slice(1).map((next, index) => travel(places[index], next, conditions.transportModes));
  const visitMinutes = Math.floor((available - travelLegs.reduce((sum, leg) => sum + leg.minutes, 0)) / places.length / 5) * 5;
  if (visitMinutes < 45) throw new Error("선택한 시간 안에 이동과 방문 시간을 맞출 수 없어요. 시간을 늘리거나 고정 일정을 조정해 주세요.");
  const totalCost = places.reduce((sum, candidate) => sum + estimateCost(candidate), 0);
  if (conditions.budget > 0 && totalCost > conditions.budget) throw new Error("입력한 예산 안에 코스를 구성하지 못했어요. 예산을 늘리거나 다른 장소를 선택해 주세요.");

  let clock = minuteOf(conditions.startTime);
  const stops: CourseStop[] = [];
  let previous: Place | null = null;
  let fixedInserted = false;
  for (const candidate of places) {
    const leg = previous ? travel(previous, candidate, conditions.transportModes) : null;
    if (leg) clock += leg.minutes;
    if (conditions.fixedSchedule && !fixedInserted && clock + visitMinutes > minuteOf(conditions.fixedSchedule.startTime)) {
      stops.push({ id: "fixed", kind: "fixed_schedule", name: conditions.fixedSchedule.title, category: "고정 일정", address: "", latitude: null, longitude: null, startTime: conditions.fixedSchedule.startTime, endTime: conditions.fixedSchedule.endTime, stayMinutes: fixedMinutes, estimatedCost: null, isRequired: true, travelFromPrevious: null });
      clock = minuteOf(conditions.fixedSchedule.endTime);
      fixedInserted = true;
    }
    const start = clock; clock += visitMinutes;
    stops.push({ id: candidate.id, kind: "place", name: candidate.name, category: candidate.category, address: candidate.roadAddress || candidate.address, latitude: candidate.latitude, longitude: candidate.longitude, startTime: timeOf(start), endTime: timeOf(clock), stayMinutes: visitMinutes, estimatedCost: estimateCost(candidate), isRequired: candidate.id === place.id, travelFromPrevious: leg });
    previous = candidate;
  }
  if (conditions.fixedSchedule && !fixedInserted) {
    stops.push({ id: "fixed", kind: "fixed_schedule", name: conditions.fixedSchedule.title, category: "고정 일정", address: "", latitude: null, longitude: null, startTime: conditions.fixedSchedule.startTime, endTime: conditions.fixedSchedule.endTime, stayMinutes: fixedMinutes, estimatedCost: null, isRequired: true, travelFromPrevious: null });
  }
  if (clock > minuteOf(conditions.endTime)) throw new Error("선택한 시간 안에 이동과 방문 시간을 맞출 수 없어요. 시간을 늘려 주세요.");
  return { date: conditions.date, requiredPlace: place, conditions, stops, totalDurationMinutes: totalWindow, totalTravelMinutes: travelLegs.reduce((sum, leg) => sum + leg.minutes, 0), estimatedTotalCost: totalCost, budget: conditions.budget, hasEstimatedTravel: true, candidateSource: "kakao" };
}

function buildAnchoredCourse(request: ValidatedCourseRequest, before: Place | null, after: Place | null): GeneratedCourse {
  const { place, conditions } = request;
  const schedule = conditions.requiredPlaceSchedule;
  if (!schedule || !conditions.courseScope) return buildCourse(request, [place, ...[before, after].filter((candidate): candidate is Place => candidate !== null)]);

  const start = minuteOf(conditions.startTime);
  const end = minuteOf(conditions.endTime);
  const anchorStart = minuteOf(schedule.startTime);
  const anchorEnd = minuteOf(schedule.endTime);
  const stops: CourseStop[] = [];
  let totalTravelMinutes = 0;

  if (before) {
    const leg = travel(before, place, conditions.transportModes);
    const visitMinutes = Math.floor((anchorStart - start - leg.minutes) / 5) * 5;
    if (visitMinutes < 45) throw new Error("선택한 장소 전에는 이동과 방문 시간을 맞출 수 없어요. 코스 시작 시간을 앞당기거나 장소 시간을 조정해 주세요.");
    totalTravelMinutes += leg.minutes;
    stops.push({ id: before.id, kind: "place", name: before.name, category: before.category, address: before.roadAddress || before.address, latitude: before.latitude, longitude: before.longitude, startTime: timeOf(start), endTime: timeOf(start + visitMinutes), stayMinutes: visitMinutes, estimatedCost: estimateCost(before), isRequired: false, travelFromPrevious: null });
    stops.push({ id: place.id, kind: "place", name: place.name, category: place.category, address: place.roadAddress || place.address, latitude: place.latitude, longitude: place.longitude, startTime: schedule.startTime, endTime: schedule.endTime, stayMinutes: anchorEnd - anchorStart, estimatedCost: estimateCost(place), isRequired: true, travelFromPrevious: leg });
  } else {
    stops.push({ id: place.id, kind: "place", name: place.name, category: place.category, address: place.roadAddress || place.address, latitude: place.latitude, longitude: place.longitude, startTime: schedule.startTime, endTime: schedule.endTime, stayMinutes: anchorEnd - anchorStart, estimatedCost: estimateCost(place), isRequired: true, travelFromPrevious: null });
  }

  if (after) {
    const leg = travel(place, after, conditions.transportModes);
    const visitStart = anchorEnd + leg.minutes;
    const visitMinutes = Math.floor((end - visitStart) / 5) * 5;
    if (visitMinutes < 45) throw new Error("선택한 장소 후에는 이동과 방문 시간을 맞출 수 없어요. 코스 종료 시간을 늦추거나 장소 시간을 조정해 주세요.");
    totalTravelMinutes += leg.minutes;
    stops.push({ id: after.id, kind: "place", name: after.name, category: after.category, address: after.roadAddress || after.address, latitude: after.latitude, longitude: after.longitude, startTime: timeOf(visitStart), endTime: timeOf(visitStart + visitMinutes), stayMinutes: visitMinutes, estimatedCost: estimateCost(after), isRequired: false, travelFromPrevious: leg });
  }

  const totalCost = stops.reduce((sum, stop) => sum + (stop.estimatedCost ?? 0), 0);
  if (conditions.budget > 0 && totalCost > conditions.budget) throw new Error("입력한 예산 안에 코스를 구성하지 못했어요. 예산을 늘리거나 다른 장소를 선택해 주세요.");
  return { date: conditions.date, requiredPlace: place, conditions, stops, totalDurationMinutes: end - start, totalTravelMinutes, estimatedTotalCost: totalCost, budget: conditions.budget, hasEstimatedTravel: true, candidateSource: "kakao" };
}

export function generateCourse(request: ValidatedCourseRequest, candidates: Place[]): GeneratedCourse {
  if (request.conditions.requiredPlaceSchedule && request.conditions.courseScope) {
    const pool = candidates.filter((candidate) => candidate.id !== request.place.id);
    const before = request.conditions.courseScope === "after" ? null : chooseCandidates(request.place, pool, 1, request.conditions.budget)[0] ?? null;
    const afterPool = before ? pool.filter((candidate) => candidate.id !== before.id) : pool;
    const after = request.conditions.courseScope === "before" ? null : chooseCandidates(request.place, afterPool, 1, request.conditions.budget)[0] ?? null;
    if ((request.conditions.courseScope === "before" && !before) || (request.conditions.courseScope === "after" && !after) || (request.conditions.courseScope === "both" && (!before || !after))) {
      throw new Error("선택한 장소 주변 후보가 충분하지 않아 코스를 만들 수 없어요. 다른 장소를 선택해 주세요.");
    }
    return buildAnchoredCourse(request, before, after);
  }
  const totalWindow = minuteOf(request.conditions.endTime) - minuteOf(request.conditions.startTime);
  const fixedMinutes = request.conditions.fixedSchedule ? minuteOf(request.conditions.fixedSchedule.endTime) - minuteOf(request.conditions.fixedSchedule.startTime) : 0;
  const desiredCount = totalWindow - fixedMinutes >= 315 ? SERVICE_CONFIG.maxStops : SERVICE_CONFIG.minStops;
  const selected = chooseCandidates(request.place, candidates, desiredCount - 1, request.conditions.budget);
  if (selected.length < SERVICE_CONFIG.minStops - 1) throw new Error("주변 후보가 충분하지 않아 코스를 만들 수 없어요. 다른 장소를 선택해 주세요.");
  return buildCourse(request, [request.place, ...selected]);
}

export function replaceCourseStop(request: ValidatedCourseRequest, currentPlaces: Place[], stopId: string, candidates: Place[]): GeneratedCourse {
  const replaceIndex = currentPlaces.findIndex((candidate) => candidate.id === stopId);
  const requiredIndex = currentPlaces.findIndex((candidate) => candidate.id === request.place.id);
  if (replaceIndex < 0 || replaceIndex === requiredIndex) throw new Error("필수 방문 장소는 바꿀 수 없어요.");
  const excludedIds = new Set(currentPlaces.map((candidate) => candidate.id));
  const previous = currentPlaces[replaceIndex - 1];
  const usedCategories = new Set(currentPlaces.filter((_, index) => index !== replaceIndex).map((candidate) => candidate.category));
  const costWithoutTarget = currentPlaces.filter((_, index) => index !== replaceIndex).reduce((sum, candidate) => sum + estimateCost(candidate), 0);
  const alternatives = candidates.filter((candidate) => !excludedIds.has(candidate.id)
    && (request.conditions.budget === 0 || costWithoutTarget + estimateCost(candidate) <= request.conditions.budget));
  if (!alternatives.length) throw new Error("바꿀 만한 주변 장소를 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
  const replacement = alternatives.sort((a, b) => score(b, previous, usedCategories, request.conditions.budget) - score(a, previous, usedCategories, request.conditions.budget))[0];
  const updatedPlaces = [...currentPlaces];
  updatedPlaces[replaceIndex] = replacement;
  if (request.conditions.requiredPlaceSchedule && request.conditions.courseScope) {
    const anchorIndex = updatedPlaces.findIndex((candidate) => candidate.id === request.place.id);
    return buildAnchoredCourse(request, updatedPlaces[anchorIndex - 1] ?? null, updatedPlaces[anchorIndex + 1] ?? null);
  }
  return buildCourse(request, updatedPlaces);
}
