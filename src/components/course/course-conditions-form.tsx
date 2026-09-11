"use client";

import { useState, type FormEvent } from "react";
import type { Place } from "@/lib/places/types";
import type { CourseConditions, ValidatedCourseRequest } from "@/lib/course/types";

const NUMBER_FORMATTER = new Intl.NumberFormat("ko-KR");

function inputValue(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

export function CourseConditionsForm({ place, onBack }: { place: Place; onBack: () => void }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasFixedSchedule, setHasFixedSchedule] = useState(false);
  const [verified, setVerified] = useState<ValidatedCourseRequest | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const budgetText = inputValue(form, "budget");
    const conditions: CourseConditions = {
      date: inputValue(form, "date"),
      startTime: inputValue(form, "startTime"),
      endTime: inputValue(form, "endTime"),
      budget: budgetText === "" ? Number.NaN : Number(budgetText),
      transportModes: form.getAll("transportModes").filter((value): value is string => typeof value === "string") as CourseConditions["transportModes"],
      fixedSchedule: hasFixedSchedule ? {
        title: inputValue(form, "fixedTitle"),
        startTime: inputValue(form, "fixedStartTime"),
        endTime: inputValue(form, "fixedEndTime"),
      } : null,
    };
    setError("");
    setVerified(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/course-conditions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ place, conditions }),
      });
      const data: unknown = await response.json();
      if (!isResponse(data)) throw new Error("입력한 조건을 다시 확인해 주세요.");
      if ("error" in data) throw new Error(data.error.message);
      if (!response.ok) throw new Error("입력한 조건을 다시 확인해 주세요.");
      setVerified(data.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "입력한 조건을 다시 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return <div className="condition-workspace">
    <section className="condition-main" aria-labelledby="conditions-title">
      <button className="back-link" type="button" onClick={onBack}><span aria-hidden="true">←</span> 장소 다시 보기</button>
      <p className="eyebrow">02 <span /> 조건 입력</p>
      <h1 id="conditions-title">함께 보낼 시간을 알려주세요.</h1>
      <p className="intro">시간과 이동 수단을 기준으로 무리 없는 동선을 만들어요. 예산은 두 사람 합계예요.</p>

      <form className="conditions-form" onSubmit={submit} noValidate>
        <fieldset>
          <legend>언제 만날까요?</legend>
          <div className="field-grid schedule-fields">
            <div className="form-field date-field"><label htmlFor="date">날짜</label><input id="date" name="date" type="date" required /></div>
            <div className="form-field"><label htmlFor="start-time">시작 시간</label><input id="start-time" name="startTime" type="time" required /></div>
            <div className="form-field"><label htmlFor="end-time">종료 시간</label><input id="end-time" name="endTime" type="time" required /></div>
          </div>
        </fieldset>

        <fieldset>
          <legend>예산과 이동</legend>
          <div className="field-grid budget-fields">
            <div className="form-field budget-field"><label htmlFor="budget">두 사람 합계 예산</label><div className="amount-input"><input id="budget" name="budget" type="number" min="0" max="10000000" step="1000" inputMode="numeric" defaultValue="0" required aria-describedby="budget-note" /><span>원</span></div><p id="budget-note" className="field-note">아직 정하지 않았다면 0원으로 둘 수 있어요.</p></div>
            <div className="form-field"><span className="form-label">이동 수단</span><div className="transport-options"><label><input type="checkbox" name="transportModes" value="walking" defaultChecked /> <span>도보</span></label><label><input type="checkbox" name="transportModes" value="public_transit" defaultChecked /> <span>대중교통</span></label></div><p className="field-note">선택한 수단만 코스에 반영해요.</p></div>
          </div>
        </fieldset>

        <fieldset className="fixed-schedule">
          <legend>고정 일정</legend>
          <div className="fixed-schedule-heading"><p className="field-note">예약, 공연처럼 시간을 비워 두어야 하는 일정이 있나요?</p><label className="switch-label"><input type="checkbox" checked={hasFixedSchedule} onChange={(event) => setHasFixedSchedule(event.target.checked)} /><span>{hasFixedSchedule ? "입력 중" : "없음"}</span></label></div>
          {hasFixedSchedule && <div className="field-grid fixed-fields">
            <div className="form-field fixed-title"><label htmlFor="fixed-title">일정 또는 장소</label><input id="fixed-title" name="fixedTitle" type="text" maxLength={80} placeholder="예: 19:30 연극 관람" required /></div>
            <div className="form-field"><label htmlFor="fixed-start-time">시작 시간</label><input id="fixed-start-time" name="fixedStartTime" type="time" required /></div>
            <div className="form-field"><label htmlFor="fixed-end-time">종료 시간</label><input id="fixed-end-time" name="fixedEndTime" type="time" required /></div>
          </div>}
        </fieldset>

        {error && <div className="form-error" role="alert"><strong>조건을 확인하지 못했어요</strong><p>{error}</p></div>}
        {verified && <div className="verification-complete" role="status"><strong>입력한 조건을 확인했어요.</strong><p>{formatVerification(verified.conditions)}</p><span>코스 생성은 다음 단계에서 이어집니다.</span></div>}
        <button className="primary-button condition-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "조건 확인 중…" : "이 조건으로 확인하기"}<span aria-hidden="true">→</span></button>
      </form>
    </section>

    <aside className="condition-place" aria-label="선택한 필수 방문 장소">
      <div className="section-line"><h2>필수 방문 장소</h2><span className="small muted">01 완료</span></div>
      <div className="condition-place-detail"><span className="place-category">{place.category}</span><strong>{place.name}</strong><p>{place.roadAddress || place.address}</p><span className="small muted">서울 · 선택한 장소는 코스에 반드시 포함돼요.</span></div>
      <button className="text-button" type="button" onClick={onBack}>장소 바꾸기</button>
    </aside>
  </div>;
}

function isResponse(value: unknown): value is { data: ValidatedCourseRequest } | { error: { message: string } } {
  return typeof value === "object" && value !== null && ("data" in value || "error" in value);
}

function formatVerification(conditions: CourseConditions) {
  const transport = conditions.transportModes.map((mode) => mode === "walking" ? "도보" : "대중교통").join(" · ");
  const fixed = conditions.fixedSchedule ? ` · 고정 일정 ${conditions.fixedSchedule.title} ${conditions.fixedSchedule.startTime}–${conditions.fixedSchedule.endTime}` : "";
  return `${conditions.date} · ${conditions.startTime}–${conditions.endTime} · ${NUMBER_FORMATTER.format(conditions.budget)}원 · ${transport}${fixed}`;
}
