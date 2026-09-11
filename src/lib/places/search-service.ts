import "server-only";
import { PlaceSearchError } from "./search-input";
import type { PlaceSearchResult } from "./types";

type FetchPlaces = (query: string, page: number) => Promise<PlaceSearchResult>;

// Single-process development guard. Deployments must use shared atomic counters/circuit state.
export function createPlaceSearchService(fetchPlaces: FetchPlaces, now = Date.now) {
  const pending = new Map<string, Promise<PlaceSearchResult>>();
  let calls: number[] = [];
  let stopped = false;
  let cooldownUntil = 0;

  return function search(query: string, page: number): Promise<PlaceSearchResult> {
    if (stopped) return Promise.reject(new PlaceSearchError("QUOTA_EXHAUSTED", "장소 검색 제공량을 모두 사용했어요. 잠시 후 다시 방문해 주세요.", 503));
    const time = now();
    if (time < cooldownUntil) return Promise.reject(new PlaceSearchError("PROVIDER_UNAVAILABLE", "장소 검색에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", 503, Math.ceil((cooldownUntil - time) / 1000)));
    const key = JSON.stringify([query, page]);
    const existing = pending.get(key);
    if (existing) return existing;
    calls = calls.filter((at) => at > time - 60_000);
    if (calls.length >= 30) return Promise.reject(new PlaceSearchError("RATE_LIMITED", "검색 요청이 많아요. 잠시 기다린 뒤 다시 검색해 주세요.", 429, Math.max(1, Math.ceil((calls[0] + 60_000 - time) / 1000))));
    calls.push(time);
    const request = Promise.resolve().then(() => fetchPlaces(query, page)).catch((error: unknown) => {
      if (error instanceof PlaceSearchError && error.code === "QUOTA_EXHAUSTED") stopped = true;
      else cooldownUntil = now() + 10_000;
      throw error;
    }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
