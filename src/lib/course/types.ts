import type { Place } from "../places/types";

export const TRANSPORT_MODES = ["walking", "public_transit"] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];

export type FixedSchedule = {
  title: string;
  startTime: string;
  endTime: string;
};

export type CourseConditions = {
  date: string;
  startTime: string;
  endTime: string;
  budget: number;
  transportModes: TransportMode[];
  fixedSchedule: FixedSchedule | null;
};

export type ValidatedCourseRequest = {
  place: Place;
  conditions: CourseConditions;
};

export type CourseStop = {
  id: string;
  kind: "place" | "fixed_schedule";
  name: string;
  category: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;
  endTime: string;
  stayMinutes: number;
  estimatedCost: number | null;
  isRequired: boolean;
  travelFromPrevious: { minutes: number; distanceMeters: number; mode: TransportMode; isEstimate: true } | null;
};

export type GeneratedCourse = {
  date: string;
  requiredPlace: Place;
  conditions: CourseConditions;
  stops: CourseStop[];
  totalDurationMinutes: number;
  totalTravelMinutes: number;
  estimatedTotalCost: number | null;
  budget: number;
  hasEstimatedTravel: true;
  candidateSource: "kakao";
};
