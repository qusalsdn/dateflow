import "server-only";

import { getKakaoRestApiKey } from "../kakao/config";
import { normalizePlaces } from "../kakao/normalize-places";
import type { Place } from "../places/types";
import { CourseConditionError } from "./conditions";

/**
 * Kakao Local does not expose Instagram saves, review counts, or a "hot place"
 * field.  These searches deliberately use its relevance ordering rather than
 * distance ordering, then the generator makes a practical route from them.
 */
const DISCOVERY_QUERY_TYPES: ReadonlyArray<{ suffix: string; categoryGroup?: string }> = [
  { suffix: "카페", categoryGroup: "CE7" },
  { suffix: "맛집", categoryGroup: "FD6" },
  { suffix: "전시", categoryGroup: "CT1" },
  { suffix: "공원" },
];

const EXCLUDED_TERMS = /게이트볼|주차장|화장실|관리사무소|안내소|정문|후문|출입구|운동장|놀이터|체육관|주민센터|경로당|복지관/u;

export function isCourseWorthyPlace(place: Place) {
  return !EXCLUDED_TERMS.test(`${place.name} ${place.category}`);
}

function neighborhoodFrom(address: string) {
  return address.split(/\s+/u).find((part) => /(?:동|가|읍|면)$/u.test(part)) ?? "서울";
}

export async function collectNearbyCandidates(anchor: Place): Promise<Place[]> {
  let key: string;
  try { key = getKakaoRestApiKey(); }
  catch { throw new CourseConditionError("NOT_CONFIGURED", "코스 생성을 위한 장소 검색 연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요."); }
  try {
    const neighborhood = neighborhoodFrom(anchor.roadAddress || anchor.address);
    const results = await Promise.all(DISCOVERY_QUERY_TYPES.map(async ({ suffix, categoryGroup }) => {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      // Request cafes and restaurants through Kakao's category groups, so a
      // generic "맛집" keyword cannot turn into another park amenity.
      // "accuracy" is Kakao's relevance ordering; distance ordering made the
      // first result a facility immediately next to the selected stop.
      const params = new URLSearchParams({ query: `${neighborhood} ${suffix}`, x: String(anchor.longitude), y: String(anchor.latitude), radius: "5000", size: "15", sort: "accuracy" });
      if (categoryGroup) params.set("category_group_code", categoryGroup);
      url.search = params.toString();
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error("candidate provider unavailable");
      return normalizePlaces(await response.json(), 1).places;
    }));
    return [...new Map(results.flat()
      .filter((place) => place.id !== anchor.id && isCourseWorthyPlace(place))
      .map((place) => [place.id, place])).values()];
  } catch {
    throw new CourseConditionError("CANDIDATE_SEARCH_FAILED", "주변 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
