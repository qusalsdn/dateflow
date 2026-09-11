export class PlaceSearchError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "PlaceSearchError";
  }
}

export function parseSearchInput(params: URLSearchParams) {
  const query = (params.get("query") ?? "").normalize("NFC").trim().replace(/\s+/gu, " ");
  const rawPage = params.get("page") ?? "1";
  if (!query || query.length > 80 || /[\p{Cc}\p{Cf}]/u.test(query)) {
    throw new PlaceSearchError("INVALID_QUERY", "장소명이나 동네를 1~80자로 입력해 주세요.", 400);
  }
  if (!/^[1-9]\d?$/.test(rawPage) || Number(rawPage) > 45) {
    throw new PlaceSearchError("INVALID_PAGE", "검색 페이지가 올바르지 않아요.", 400);
  }
  return { query, page: Number(rawPage) };
}
