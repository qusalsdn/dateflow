import "server-only";

import type { Place } from "../places/types";
import {
  TRANSPORT_MODES,
  type CourseConditions,
  type FixedSchedule,
  type TransportMode,
  type ValidatedCourseRequest,
} from "./types";

const SEOUL_BOUNDS = { minLongitude: 126.76, maxLongitude: 127.19, minLatitude: 37.42, maxLatitude: 37.71 };
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class CourseConditionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new CourseConditionError("INVALID_INPUT", `${label}을 입력해 주세요.`);
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (!normalized || normalized.length > maxLength) throw new CourseConditionError("INVALID_INPUT", `${label}은 1~${maxLength}자로 입력해 주세요.`);
  return normalized;
}

function parseDate(value: unknown) {
  if (typeof value !== "string") throw new CourseConditionError("INVALID_DATE", "날짜를 선택해 주세요.");
  const match = DATE.exec(value);
  if (!match) throw new CourseConditionError("INVALID_DATE", "날짜를 올바르게 선택해 주세요.");
  const [year, month, day] = match.slice(1).map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new CourseConditionError("INVALID_DATE", "날짜를 올바르게 선택해 주세요.");
  }
  return value;
}

function parseTime(value: unknown, label: string) {
  if (typeof value !== "string" || !TIME.test(value)) throw new CourseConditionError("INVALID_TIME", `${label}을 올바르게 선택해 주세요.`);
  return value;
}

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function parseCoursePlace(value: unknown, label = "필수 방문 장소"): Place {
  if (!isRecord(value)) throw new CourseConditionError("INVALID_PLACE", "필수 방문 장소를 다시 선택해 주세요.");
  const id = typeof value.id === "string" && /^\d{1,30}$/.test(value.id) ? value.id : "";
  const name = text(value.name, "장소 이름", 120);
  const category = text(value.category, "장소 분류", 80);
  const address = text(value.address, "장소 주소", 180);
  const roadAddress = typeof value.roadAddress === "string" ? value.roadAddress.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
  const latitude = typeof value.latitude === "number" ? value.latitude : Number.NaN;
  const longitude = typeof value.longitude === "number" ? value.longitude : Number.NaN;
  if (!id || !/^(서울|서울특별시)\s/u.test(address)
    || !Number.isFinite(latitude) || !Number.isFinite(longitude)
    || latitude < SEOUL_BOUNDS.minLatitude || latitude > SEOUL_BOUNDS.maxLatitude
    || longitude < SEOUL_BOUNDS.minLongitude || longitude > SEOUL_BOUNDS.maxLongitude) {
    throw new CourseConditionError("INVALID_PLACE", `서울의 ${label}를 다시 선택해 주세요.`);
  }
  return { id, name, category, address, roadAddress, latitude, longitude, url: `https://place.map.kakao.com/${id}` };
}

function parseTransportModes(value: unknown): TransportMode[] {
  if (!Array.isArray(value) || !value.length) throw new CourseConditionError("INVALID_TRANSPORT", "이동 수단을 하나 이상 선택해 주세요.");
  const modes = [...new Set(value)];
  if (!modes.every((mode): mode is TransportMode => typeof mode === "string" && (TRANSPORT_MODES as readonly string[]).includes(mode))) {
    throw new CourseConditionError("INVALID_TRANSPORT", "이동 수단을 다시 선택해 주세요.");
  }
  return modes;
}

function parseBudget(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 10_000_000) {
    throw new CourseConditionError("INVALID_BUDGET", "두 사람 합계 예산을 0원에서 1,000만원 사이로 입력해 주세요.");
  }
  return value;
}

function parseFixedSchedule(value: unknown, startTime: string, endTime: string): FixedSchedule | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new CourseConditionError("INVALID_FIXED_SCHEDULE", "고정 일정 정보를 다시 입력해 주세요.");
  const title = text(value.title, "고정 일정 이름", 80);
  const fixedStart = parseTime(value.startTime, "고정 일정 시작 시간");
  const fixedEnd = parseTime(value.endTime, "고정 일정 종료 시간");
  if (minutes(fixedStart) >= minutes(fixedEnd)
    || minutes(fixedStart) < minutes(startTime) || minutes(fixedEnd) > minutes(endTime)) {
    throw new CourseConditionError("INVALID_FIXED_SCHEDULE", "고정 일정은 만남 시간 안에서 시작과 종료를 정해 주세요.");
  }
  return { title, startTime: fixedStart, endTime: fixedEnd };
}

export function parseCourseConditions(value: unknown): ValidatedCourseRequest {
  if (!isRecord(value) || !isRecord(value.conditions)) throw new CourseConditionError("INVALID_INPUT", "입력한 조건을 다시 확인해 주세요.");
  const place = parseCoursePlace(value.place);
  const date = parseDate(value.conditions.date);
  const startTime = parseTime(value.conditions.startTime, "시작 시간");
  const endTime = parseTime(value.conditions.endTime, "종료 시간");
  if (minutes(startTime) >= minutes(endTime)) throw new CourseConditionError("INVALID_TIME", "종료 시간은 시작 시간보다 늦어야 해요.");

  const conditions: CourseConditions = {
    date,
    startTime,
    endTime,
    budget: parseBudget(value.conditions.budget),
    transportModes: parseTransportModes(value.conditions.transportModes),
    fixedSchedule: parseFixedSchedule(value.conditions.fixedSchedule, startTime, endTime),
  };
  return { place, conditions };
}
