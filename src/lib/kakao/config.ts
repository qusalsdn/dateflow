import "server-only";

export function getKakaoRestApiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error("카카오 API 연결 설정이 필요합니다.");
  return key;
}
