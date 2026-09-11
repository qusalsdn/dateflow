import assert from "node:assert/strict";
import test from "node:test";
import { parseSearchInput, PlaceSearchError } from "../src/lib/places/search-input";
import { normalizePlaces } from "../src/lib/kakao/normalize-places";
import { createPlaceSearchService } from "../src/lib/places/search-service";
import type { PlaceSearchResult } from "../src/lib/places/types";
import { CourseConditionError, parseCourseConditions } from "../src/lib/course/conditions";

const document = { id: "1", place_name: "테스트 장소", address_name: "서울 성동구 성수동1가", road_address_name: "", category_name: "여행 > 공원", x: "127.0376", y: "37.5443", place_url: "javascript:alert(1)" };
const empty: PlaceSearchResult = { places: [], nextPage: null };

test("검색어 공백 정리와 페이지 검증", () => {
  assert.deepEqual(parseSearchInput(new URLSearchParams({ query: "  연남동   카페 ", page: "2" })), { query: "연남동 카페", page: 2 });
  for (const query of ["  ", "a".repeat(81), "서울\u200b"]) assert.throws(() => parseSearchInput(new URLSearchParams({ query })), PlaceSearchError);
  for (const page of ["0", "46", "1.5", "-1", "1e1", "", "01"]) assert.throws(() => parseSearchInput(new URLSearchParams({ query: "서울숲", page })), PlaceSearchError);
});

test("서울 주소만 포함하고 중복 ID 제거 및 안전한 상세 링크 생성", () => {
  const result = normalizePlaces({ meta: { is_end: false }, documents: [document, document, { ...document, id: "2", address_name: "경기 구리시" }, { ...document, id: "3", address_name: "서울특별시 종로구", road_address_name: "서울 종로구 테스트로 1" }] }, 1);
  assert.equal(result.places.length, 2);
  assert.equal(result.places[0].url, "https://place.map.kakao.com/1");
  assert.equal(result.places[0].category, "공원");
  assert.equal(result.places[0].roadAddress, "");
  assert.equal(result.nextPage, 2);
});

test("서울 외 결과만 있는 페이지도 다음 페이지를 보존", () => {
  assert.deepEqual(normalizePlaces({ meta: { is_end: false }, documents: [{ ...document, address_name: "경기 과천시" }] }, 1), { places: [], nextPage: 2 });
  assert.equal(normalizePlaces({ meta: { is_end: false }, documents: [] }, 45).nextPage, null);
  assert.equal(normalizePlaces({ meta: { is_end: true }, documents: [] }, 1).nextPage, null);
});

test("공급자 응답 및 잘못된 좌표를 빈 성공 응답으로 처리하지 않음", () => {
  assert.throws(() => normalizePlaces({}, 1));
  for (const x of ["", "NaN", "Infinity", "0", "128"]) assert.throws(() => normalizePlaces({ meta: { is_end: true }, documents: [{ ...document, x }] }, 1));
});

test("진행 중 동일 요청만 공유하고 완료된 결과는 보관하지 않음", async () => {
  let calls = 0;
  let finish!: (result: PlaceSearchResult) => void;
  const search = createPlaceSearchService(() => { calls++; return new Promise((resolve) => { finish = resolve; }); });
  const first = search("서울숲", 1);
  const second = search("서울숲", 1);
  assert.equal(first, second);
  await Promise.resolve();
  finish(empty);
  await first;
  assert.equal(calls, 1);
  const third = search("서울숲", 1);
  await Promise.resolve();
  finish(empty);
  await third;
  assert.equal(calls, 2);
});

test("분당 전역 호출 제한은 서버에서 차단하며 시간이 지나면 회복", async () => {
  let now = 0;
  let calls = 0;
  const search = createPlaceSearchService(async () => { calls++; return empty; }, () => now);
  for (let index = 0; index < 30; index++) await search(`검색${index}`, 1);
  await assert.rejects(search("추가 검색", 1), (error: unknown) => error instanceof PlaceSearchError && error.status === 429 && error.retryAfter === 60);
  assert.equal(calls, 30);
  now = 60_000;
  await search("다시 검색", 1);
  assert.equal(calls, 31);
});

test("공급자 쿼터 소진 후 새로운 외부 호출 중단", async () => {
  let calls = 0;
  const search = createPlaceSearchService(async () => { calls++; throw new PlaceSearchError("QUOTA_EXHAUSTED", "한도 초과", 503); });
  await assert.rejects(search("첫 검색", 1));
  await assert.rejects(search("다른 검색", 2), (error: unknown) => error instanceof PlaceSearchError && error.code === "QUOTA_EXHAUSTED");
  assert.equal(calls, 1);
});

test("일시적 오류에는 재호출 간격을 두고 회복 후 검색 허용", async () => {
  let now = 0;
  let calls = 0;
  const search = createPlaceSearchService(async () => { if (++calls === 1) throw new Error("temporary"); return empty; }, () => now);
  await assert.rejects(search("검색", 1));
  await assert.rejects(search("재시도", 1));
  assert.equal(calls, 1);
  now = 10_000;
  assert.deepEqual(await search("재시도", 1), empty);
});

const courseRequest = {
  place: { id: "123", name: "서울숲", category: "공원", address: "서울 성동구 뚝섬로 273", roadAddress: "서울 성동구 뚝섬로 273", latitude: 37.5444, longitude: 127.0374, url: "https://untrusted.example" },
  conditions: { date: "2026-10-10", startTime: "13:00", endTime: "21:00", budget: 85000, transportModes: ["walking", "public_transit"], fixedSchedule: { title: "19:30 공연", startTime: "19:30", endTime: "21:00" } },
};

test("선택 장소와 코스 조건은 서버에서 정규화하고 검증", () => {
  const parsed = parseCourseConditions(courseRequest);
  assert.equal(parsed.place.url, "https://place.map.kakao.com/123");
  assert.deepEqual(parsed.conditions.transportModes, ["walking", "public_transit"]);
  assert.equal(parsed.conditions.fixedSchedule?.title, "19:30 공연");
});

test("유효하지 않은 장소, 시간, 고정 일정, 예산, 이동 수단을 거절", () => {
  const invalidCases = [
    { ...courseRequest, place: { ...courseRequest.place, address: "경기 구리시" } },
    { ...courseRequest, conditions: { ...courseRequest.conditions, endTime: "13:00" } },
    { ...courseRequest, conditions: { ...courseRequest.conditions, budget: -1 } },
    { ...courseRequest, conditions: { ...courseRequest.conditions, transportModes: ["car"] } },
    { ...courseRequest, conditions: { ...courseRequest.conditions, fixedSchedule: { title: "공연", startTime: "12:30", endTime: "14:00" } } },
    { ...courseRequest, conditions: { ...courseRequest.conditions, date: "2026-02-30" } },
  ];
  for (const invalid of invalidCases) assert.throws(() => parseCourseConditions(invalid), CourseConditionError);
});
