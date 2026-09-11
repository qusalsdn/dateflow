import "server-only";
import { getKakaoRestApiKey } from "./config";
import { normalizePlaces, SEOUL_RECT } from "./normalize-places";
import { PlaceSearchError } from "../places/search-input";
import { createPlaceSearchService } from "../places/search-service";

async function fetchPlaces(query: string, page: number) {
  let key: string;
  try { key = getKakaoRestApiKey(); }
  catch { throw new PlaceSearchError("NOT_CONFIGURED", "장소 검색 연결을 준비하고 있어요. 잠시 후 다시 방문해 주세요.", 503); }
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.search = new URLSearchParams({ query, page: String(page), size: "15", rect: SEOUL_RECT, sort: "accuracy" }).toString();
  try {
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    // Kakao uses -10 for quota exhaustion. Never forward its raw error body.
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      if (response.status === 429 || (typeof error === "object" && error !== null && "code" in error && error.code === -10)) {
        throw new PlaceSearchError("QUOTA_EXHAUSTED", "장소 검색 제공량을 모두 사용했어요. 잠시 후 다시 방문해 주세요.", 503);
      }
      throw new PlaceSearchError("PROVIDER_UNAVAILABLE", "장소 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
    }
    return normalizePlaces(await response.json(), page);
  } catch (error) {
    if (error instanceof PlaceSearchError) throw error;
    throw new PlaceSearchError("SEARCH_FAILED", "장소를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", 502);
  }
}

const globalSearch = globalThis as typeof globalThis & { dateflowPlaceSearch?: ReturnType<typeof createPlaceSearchService> };
export const searchPlaces = globalSearch.dateflowPlaceSearch ??= createPlaceSearchService(fetchPlaces);
