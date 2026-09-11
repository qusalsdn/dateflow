import { searchPlaces } from "@/lib/kakao/search-places";
import { parseSearchInput, PlaceSearchError } from "@/lib/places/search-input";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new PlaceSearchError("CROSS_SITE_REQUEST", "이 화면에서 다시 검색해 주세요.", 403);
    }
    const { query, page } = parseSearchInput(new URL(request.url).searchParams);
    return Response.json(await searchPlaces(query, page), { headers });
  } catch (error) {
    const failure = error instanceof PlaceSearchError ? error : new PlaceSearchError("SEARCH_FAILED", "장소를 불러오지 못했어요. 다시 시도해 주세요.", 502);
    if (failure.retryAfter) headers.set("Retry-After", String(failure.retryAfter));
    return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers });
  }
}
