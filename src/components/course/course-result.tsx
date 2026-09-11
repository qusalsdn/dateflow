"use client";

import { useState } from "react";
import type { GeneratedCourse } from "@/lib/course/types";
import type { Place } from "@/lib/places/types";
import { PlaceMap } from "@/components/places/place-map";
import Link from "next/link";

const currency = new Intl.NumberFormat("ko-KR");

export function CourseResult({ course, onBack, onUpdated }: { course: GeneratedCourse; onBack: () => void; onUpdated: (course: GeneratedCourse) => void }) {
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState<"replace" | "save" | "share">("replace");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [shareUrl, setShareUrl] = useState("");
  const places: Place[] = course.stops.filter((stop): stop is typeof stop & { latitude: number; longitude: number } => stop.kind === "place" && stop.latitude !== null && stop.longitude !== null).map((stop) => ({ id: stop.id, name: stop.name, category: stop.category, address: stop.address, roadAddress: stop.address, latitude: stop.latitude, longitude: stop.longitude, url: `https://place.map.kakao.com/${stop.id}` }));
  async function replace(stopId: string) {
    setError(""); setErrorAction("replace");
    setReplacingId(stopId);
    try {
      const response = await fetch("/api/courses/replace", { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify({ course, stopId }) });
      const data: unknown = await response.json();
      if (!isCourseResponse(data)) throw new Error("장소를 바꾸지 못했어요. 다시 시도해 주세요.");
      if ("error" in data) throw new Error(data.error.message);
      if (!response.ok) throw new Error("장소를 바꾸지 못했어요. 다시 시도해 주세요.");
      onUpdated(data.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "장소를 바꾸지 못했어요. 다시 시도해 주세요.");
    } finally {
      setReplacingId(null);
    }
  }
  async function save() {
    setError(""); setErrorAction("save"); setSaveState("saving");
    try {
      const response = await fetch("/api/courses/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ course }) });
      const data: unknown = await response.json();
      if (!isSaveResponse(data)) throw new Error("코스를 저장하지 못했어요.");
      if (response.status === 401) {
        window.sessionStorage.setItem("dateflow:course-to-save", JSON.stringify(course));
        const { createClient } = await import("@/lib/supabase/client");
        const { error: loginError } = await createClient().auth.signInWithOAuth({ provider: "kakao", options: { redirectTo: `${window.location.origin}/auth/callback?next=/` } });
        if (loginError) throw loginError;
        return;
      }
      if ("error" in data || !response.ok) throw new Error("error" in data ? data.error.message : "코스를 저장하지 못했어요.");
      setSaveState("saved");
      return data.data.publicId;
    } catch (cause) { setError(cause instanceof Error ? cause.message : "코스를 저장하지 못했어요."); setSaveState("idle"); }
  }
  async function share() {
    setErrorAction("share");
    let publicId = "";
    if (!shareUrl) publicId = await save() || "";
    else publicId = shareUrl.split("/").pop() || "";
    if (!publicId) return;
    const response = await fetch(`/api/courses/${publicId}/share`, { method: "POST" });
    if (!response.ok) { setError("공유 링크를 만들지 못했어요."); return; }
    const url = `${window.location.origin}/share/${publicId}`;
    setShareUrl(url); setSaveState("saved");
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }
  return <div className="course-workspace">
    <section className="course-main" aria-labelledby="course-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> 조건 다시 입력</button>
      <p className="eyebrow">03 <span /> 코스 확인 · 교체</p>
      <h1 id="course-title">오늘의 동선을 만들었어요.</h1>
      <p className="intro">필수 장소와 고정 일정은 유지돼요. 다른 장소는 바꾸면 이동과 이후 시간을 다시 계산해요.</p>
      <div className="course-summary" aria-label="코스 요약"><span>{course.stops.filter((stop) => stop.kind === "place").length}곳</span><span>이동 약 {course.totalTravelMinutes}분</span><span>{course.estimatedTotalCost === null ? "비용 확인 필요" : `예상 ${currency.format(course.estimatedTotalCost)}원`}</span></div>
      <ol className="course-timeline">
        {course.stops.map((stop, index) => <li key={`${stop.id}-${index}`} className={stop.kind === "fixed_schedule" ? "fixed-stop" : ""}>
          {stop.travelFromPrevious && <p className="travel-leg"><span aria-hidden="true">↳</span> {stop.travelFromPrevious.mode === "walking" ? "도보" : "대중교통"} 약 {stop.travelFromPrevious.minutes}분 · {Math.round(stop.travelFromPrevious.distanceMeters / 100) / 10}km <em>추정</em></p>}
          <div className="timeline-stop"><time>{stop.startTime}</time><div><p className="place-category">{stop.isRequired ? "필수 방문 장소" : stop.category}</p><h2>{stop.name}</h2>{stop.address && <p className="muted small">{stop.address}</p>}<p className="stop-meta">{stop.endTime}까지 · {stop.stayMinutes}분{stop.estimatedCost !== null && ` · 약 ${currency.format(stop.estimatedCost)}원`}</p>{stop.kind === "place" && !stop.isRequired && <button className="replace-button" type="button" disabled={replacingId !== null} onClick={() => void replace(stop.id)}>{replacingId === stop.id ? "주변 장소를 찾는 중…" : "이 장소 바꾸기"}<span aria-hidden="true">→</span></button>}</div></div>
        </li>)}
      </ol>
      {error && <div className="form-error course-error" role="alert"><strong>{errorAction === "replace" ? "장소를 바꾸지 못했어요" : errorAction === "save" ? "코스를 저장하지 못했어요" : "공유 링크를 만들지 못했어요"}</strong><p>{error}</p></div>}
      <section className="course-actions" aria-label="코스 저장과 공유"><div><h2>이 코스를 남겨둘까요?</h2><p>저장은 카카오 로그인 후 내 계정에만 보관돼요. 공유 링크에는 코스 정보만 공개돼요.</p></div><div className="course-action-buttons"><button className="primary-button" type="button" disabled={saveState === "saving" || saveState === "saved"} onClick={() => void save()}>{saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : "코스 저장"}</button><button className="secondary-button" type="button" disabled={saveState === "saving"} onClick={() => void share()}>{shareUrl ? "링크 복사" : "공유 링크 만들기"}</button></div>{saveState === "saved" && <Link className="text-button" href="/courses">저장한 코스 보기</Link>}{shareUrl && <p className="share-confirmation" role="status">공유 링크를 복사했어요. <a href={shareUrl}>새 창에서 확인</a></p>}</section>
      <p className="source-note">주변 장소 정보 · 카카오맵 · 이동 시간과 비용은 실제 경로·가격 확인 전 추정치예요.</p>
    </section>
    <aside className="course-map-panel" aria-label="생성한 코스 지도">
      <div className="section-line"><h2>코스 지도</h2><span className="small muted">방문 순서</span></div>
      <PlaceMap places={places} activeId={null} onPreview={() => undefined} />
    </aside>
  </div>;
}

function isCourseResponse(value: unknown): value is { data: GeneratedCourse } | { error: { message: string } } {
  return typeof value === "object" && value !== null && ("data" in value || "error" in value);
}

function isSaveResponse(value: unknown): value is { data: { publicId: string } } | { error: { message: string } } {
  return typeof value === "object" && value !== null && ("data" in value || "error" in value);
}
