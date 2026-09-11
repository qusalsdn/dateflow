import "server-only";

import { getKakaoRestApiKey } from "../kakao/config";
import { normalizePlaces } from "../kakao/normalize-places";
import type { Place } from "../places/types";
import { CourseConditionError } from "./conditions";

const QUERIES = ["카페", "음식점", "전시", "공원"];

export async function collectNearbyCandidates(anchor: Place): Promise<Place[]> {
  let key: string;
  try { key = getKakaoRestApiKey(); }
  catch { throw new CourseConditionError("NOT_CONFIGURED", "코스 생성을 위한 장소 검색 연결을 준비하고 있어요. 잠시 후 다시 시도해 주세요."); }
  try {
    const results = await Promise.all(QUERIES.map(async (query) => {
      const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
      url.search = new URLSearchParams({ query, x: String(anchor.longitude), y: String(anchor.latitude), radius: "3500", size: "15", sort: "distance" }).toString();
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok) throw new Error("candidate provider unavailable");
      return normalizePlaces(await response.json(), 1).places;
    }));
    return [...new Map(results.flat().filter((place) => place.id !== anchor.id).map((place) => [place.id, place])).values()];
  } catch {
    throw new CourseConditionError("CANDIDATE_SEARCH_FAILED", "주변 장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
}
