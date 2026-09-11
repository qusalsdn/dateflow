import type { Place, PlaceSearchResult } from "../places/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The rectangle reduces candidates; the provider's address determines Seoul membership.
export const SEOUL_RECT = "126.76,37.42,127.19,37.71";

export function normalizePlaces(data: unknown, page: number): PlaceSearchResult {
  if (!isRecord(data) || !Array.isArray(data.documents) || !isRecord(data.meta)
    || typeof data.meta.is_end !== "boolean") {
    throw new Error("Invalid place search response");
  }
  const places: Place[] = [];
  const seen = new Set<string>();
  for (const item of data.documents) {
    if (!isRecord(item)) throw new Error("Invalid place document");
    const { id, place_name: name, address_name: address, x, y } = item;
    if (typeof id !== "string" || !/^\d+$/.test(id) || typeof name !== "string" || !name.trim()
      || typeof address !== "string" || typeof x !== "string" || !x.trim()
      || typeof y !== "string" || !y.trim()) throw new Error("Invalid place fields");
    if (!/^(서울|서울특별시)\s/.test(address)) continue;
    const longitude = Number(x);
    const latitude = Number(y);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)
      || longitude < 126.76 || longitude > 127.19 || latitude < 37.42 || latitude > 37.71) {
      throw new Error("Invalid Seoul coordinates");
    }
    if (seen.has(id)) continue;
    seen.add(id);
    places.push({
      id, name, address, longitude, latitude,
      roadAddress: typeof item.road_address_name === "string" ? item.road_address_name : "",
      category: typeof item.category_name === "string" ? item.category_name.split(" > ").at(-1) || "장소" : "장소",
      // Construct a trusted HTTPS link instead of accepting arbitrary provider URLs.
      url: `https://place.map.kakao.com/${id}`,
    });
  }
  return { places, nextPage: data.meta.is_end || page >= 45 ? null : page + 1 };
}
