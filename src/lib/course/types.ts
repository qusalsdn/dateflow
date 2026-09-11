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
