# Dateflow

서울에서 선택한 장소 하나를 중심으로 도보·대중교통 데이트 코스를 구성하는 웹 서비스.

## 개발 시작

Node.js 22 이상과 pnpm 11.10.0을 사용합니다. 운영 환경에는 지원 중인 Node.js LTS를 사용하세요. 의존성은 `pnpm-lock.yaml`로 관리합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

기본 주소: http://localhost:3000

초기 화면은 환경 변수 없이 실행됩니다. 실제 API를 연결할 때 `.env.example`을 `.env.local`로 복사하고 값을 입력하세요. 비밀 키는 저장소에 올리지 않습니다.

## 확인 명령

```sh
pnpm check
pnpm build
```

## 구성

- Next.js App Router, React, TypeScript strict 모드
- Tailwind CSS와 shadcn/ui 구성 파일·공통 스타일 유틸리티 (UI 컴포넌트는 필요할 때 추가)
- Supabase 브라우저·서버 클라이언트 팩토리
- 카카오 서버 전용 API 키 설정
- `src/lib/config.ts`: 서울, 한국 시간대, 도보·대중교통, 3~4개 장소 기본값

## 연결 설정

| 환경 변수 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase 공개용 publishable key |
| `NEXT_PUBLIC_KAKAO_MAP_APP_KEY` | 카카오 지도 JavaScript 키 |
| `KAKAO_REST_API_KEY` | 서버에서만 사용하는 카카오 REST API 키 |

Supabase 관리자용 secret/service-role key를 공개 환경 변수에 넣지 않습니다. 사용자 데이터 테이블을 추가할 때 RLS와 소유자 접근 정책을 함께 작성해야 합니다.

현재 Supabase 서버 팩토리는 쿠키를 쓸 수 있는 Route Handler/Server Action용입니다. 로그인 구현 단계에서 OAuth 콜백, 세션 갱신 proxy, 인증 검증, 오류 처리를 함께 추가해야 합니다. 클라이언트 파일만으로 로그인이 완성된 상태는 아닙니다.

## 첫 버전 범위

- 서울 기준 장소 검색
- 시간·두 사람 합계 예산·이동 조건 입력
- 규칙 기반 코스 생성과 장소 일부 교체
- 비회원 코스 생성, 로그인 후 저장, 링크 공유
- 카카오 로그인 및 도보·대중교통 API 연결

현재는 초기 설정과 준비 화면만 구현되어 있습니다. 외부 API 호출, 장소 검색, 추천 엔진, 로그인, DB 테이블, 저장·공유는 아직 구현되지 않았습니다. 샘플 데이터를 실제 추천처럼 제공하지 않습니다.

## 무료 운영 원칙

유료 AI API를 사용하지 않습니다. 사용자당 일일 생성 제한은 우선 두지 않으며, API 연결 시 중복 요청 방지·짧은 시간 과다 요청 차단·무료 쿼터 도달 시 중단을 구현합니다. 유료 추가 사용은 활성화하지 않습니다.

이 저장소의 초기 설정은 외부 서비스 가입, 리소스 생성, 배포를 수행하지 않습니다. 무료 쿼터와 대상 앱 조건은 연결 시 확인합니다. Vercel Hobby는 개인·비상업적 이용에 한정되므로 사업 목적 공개 전 배포 환경을 결정해야 합니다.
