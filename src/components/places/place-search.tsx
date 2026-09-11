"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Place, PlaceSearchResult } from "@/lib/places/types";
import { PlaceMap } from "./place-map";
import { CourseConditionsForm } from "@/components/course/course-conditions-form";

export function PlaceSearch() {
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [preview, setPreview] = useState<Place | null>(null);
  const [selected, setSelected] = useState<Place | null>(null);
  const [isEnteringConditions, setIsEnteringConditions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedPage, setFailedPage] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function search(text: string, page = 1) {
    const normalized = text.trim().replace(/\s+/gu, " ");
    if (!normalized || normalized.length > 80) {
      setError("장소명이나 동네를 1~80자로 입력해 주세요.");
      setFailedPage(null);
      input.current?.focus();
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setFailedPage(null);
    setSearchedQuery(normalized);
    if (page === 1) { setPlaces([]); setNextPage(null); setPreview(selected); }
    try {
      const response = await fetch(`/api/places?${new URLSearchParams({ query: normalized, page: String(page) })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "검색에 연결하지 못했어요. 다시 시도해 주세요.");
      if (controller.signal.aborted) return;
      const result = data as PlaceSearchResult;
      setPlaces((previous) => {
        const merged = page === 1 ? result.places : [...previous, ...result.places];
        return [...new Map(merged.map((place) => [place.id, place])).values()];
      });
      setNextPage(result.nextPage);
      if (page === 1 && !selected) setPreview(result.places[0] ?? null);
      setAnnouncement(result.places.length ? `장소 ${result.places.length}개를 불러왔어요.` : "이번 검색 페이지에는 서울의 장소가 없어요.");
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "장소를 불러오지 못했어요.");
      setFailedPage(page);
    } finally {
      if (request.current === controller) setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void search(query); }
  const showPreview = useCallback((place: Place) => {
    setPreview(place);
    if (window.matchMedia("(max-width: 700px)").matches) {
      requestAnimationFrame(() => detail.current?.focus());
    }
  }, []);
  const mapPlaces = useMemo(() => {
    const all = [...places];
    if (selected && !all.some((place) => place.id === selected.id)) all.push(selected);
    return all;
  }, [places, selected]);

  if (selected && isEnteringConditions) {
    return <CourseConditionsForm place={selected} onBack={() => setIsEnteringConditions(false)} />;
  }

  return <div className="place-workspace">
    <section className="search-heading" aria-labelledby="search-title">
      <p className="eyebrow">01 <span /> 장소 선택</p>
      <h1 id="search-title">어디에 가고 싶나요?</h1>
      <p className="intro">이번 만남에 꼭 넣고 싶은 서울의 장소를 찾아보세요.</p>
      <form role="search" onSubmit={submit} className="search-form">
        <label htmlFor="place-query">장소명 또는 동네</label>
        <div className="search-field">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
          <input ref={input} id="place-query" type="search" autoComplete="off" placeholder="예: 서울숲, 연남동 카페" maxLength={80} value={query} onChange={(event) => setQuery(event.target.value)} aria-invalid={!!error && failedPage === null} aria-describedby={error ? "search-hint search-error" : "search-hint"} />
          <button className="primary-button" type="submit" disabled={loading}>검색</button>
        </div>
        <p id="search-hint" className="small muted">서울 지역만 검색해요. 같은 이름의 장소는 주소로 구분해 주세요.</p>
      </form>
    </section>

    <section className="results-panel" aria-labelledby="results-title" aria-busy={loading}>
      <div className="section-line"><h2 id="results-title">{searchedQuery ? "검색 결과" : "이렇게 찾아보세요"}</h2><span className="small muted">{searchedQuery ? `현재 ${places.length}곳` : "장소에서 시작하는 하루"}</span></div>
      {!searchedQuery && <div className="search-suggestions">
        <p>가고 싶었던 곳이 있나요?<br /><span className="muted">장소 이름이나 동네와 취향을 함께 입력해 보세요.</span></p>
        {["서울숲", "연남동 카페", "서촌 전시"].map((text) => <button key={text} onClick={() => { setQuery(text); void search(text); }}><span>{text}</span><span aria-hidden="true">↗</span></button>)}
        <p className="small muted">추천 장소가 아닌 검색어 예시예요.</p>
      </div>}
      {error && <div id="search-error" className="search-error" role="alert"><strong>검색을 완료하지 못했어요</strong><p>{error}</p>{failedPage !== null && <button className="text-button" disabled={loading} onClick={() => void search(searchedQuery, failedPage)}>다시 시도</button>}</div>}
      {searchedQuery && !loading && !error && !places.length && <div className="empty-results"><h3>서울에서 일치하는 장소를 찾지 못했어요</h3><p>장소 이름을 짧게 입력하거나,<br />동네 이름을 함께 검색해 보세요.</p>{nextPage && <p className="small">다음 결과에 서울의 장소가 있을 수 있어요.</p>}</div>}
      <ol className="place-list">
        {places.map((place, index) => <li key={place.id}>
          <button className={`place-row${preview?.id === place.id ? " is-preview" : ""}`} aria-pressed={preview?.id === place.id} onClick={() => showPreview(place)} aria-label={`${place.name}, ${place.roadAddress || place.address}, 위치와 상세 정보 확인`}>
            <span className="place-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="place-row-content"><span className="place-category">{place.category}</span><strong>{place.name}</strong><span className="place-address">{place.roadAddress || place.address}</span>{selected?.id === place.id && <span className="selected-label">✓ 필수 방문 장소</span>}</span>
            <span className="row-arrow" aria-hidden="true">↗</span>
          </button>
        </li>)}
      </ol>
      {loading && <p className="loading-status" role="status"><span className="loading-dot" />{places.length ? "다음 장소를 불러오고 있어요…" : "서울의 장소를 찾고 있어요…"}</p>}
      {nextPage && !error && <button className="more-button" disabled={loading} onClick={() => void search(searchedQuery, nextPage)}>검색 결과 더 보기 <span aria-hidden="true">↓</span></button>}
      {!!places.length && <p className="source-note">장소 정보 · 카카오맵</p>}
    </section>

    <aside className={`place-panel${preview ? " has-preview" : ""}`} aria-label="장소 위치와 선택">
      <div className="section-line"><h2>이번 만남의 한 장소</h2><span className="small muted">서울</span></div>
      {mapPlaces.length > 0 ? <PlaceMap places={mapPlaces} activeId={preview?.id ?? null} onPreview={showPreview} /> : <div className="place-placeholder">
        <svg className="location-symbol" viewBox="0 0 64 80" fill="none" aria-hidden="true"><path d="M32 69S9 45 9 29a23 23 0 0 1 46 0c0 16-23 40-23 40Z" stroke="currentColor" strokeWidth="1.3"/><circle cx="32" cy="29" r="8" stroke="currentColor" strokeWidth="1.3"/><path d="M17 76h30" stroke="currentColor" strokeWidth="1.3"/></svg>
        <h2>마음에 둔 장소 하나부터.</h2><p>검색한 장소를 누르면<br />이곳에서 위치와 주소를 확인할 수 있어요.</p>
      </div>}
      {preview && <div className="place-detail" ref={detail} tabIndex={-1} aria-label={`${preview.name} 상세 정보`}>
        <p className="eyebrow">{selected?.id === preview.id ? "✓ 필수 방문 장소" : "장소 살펴보기"}</p>
        <span className="place-category">{preview.category}</span>
        <h2>{preview.name}</h2>
        <p>{preview.roadAddress || preview.address}</p>
        {preview.roadAddress && <p className="small muted">지번 · {preview.address}</p>}
        <a className="detail-link" href={preview.url} target="_blank" rel="noopener noreferrer">카카오맵에서 상세 정보 보기 <span aria-hidden="true">↗</span><span className="sr-only"> (새 탭)</span></a>
        <p className="small muted detail-note">영업시간과 가격은 방문 전 상세 정보에서 확인해 주세요.</p>
        {selected?.id === preview.id ? <div className="selection-complete"><p><strong>이 장소를 선택했어요.</strong><br /><span className="small">시간과 예산을 입력해 다음 단계로 넘어가세요.</span></p><button className="primary-button select-button" onClick={() => setIsEnteringConditions(true)}>조건 입력하기<span aria-hidden="true">→</span></button><button className="text-button" onClick={() => { setSelected(null); if (!places.some((place) => place.id === selected.id)) setPreview(places[0] ?? null); setAnnouncement("필수 방문 장소 선택을 해제했어요."); }}>선택 해제</button></div> : <button className="primary-button select-button" onClick={() => { setSelected(preview); setAnnouncement(`${preview.name}을 필수 방문 장소로 선택했어요.`); }}>{selected ? "이 장소로 변경" : "이 장소를 필수 방문 장소로 선택"}<span aria-hidden="true">＋</span></button>}
      </div>}
      {selected && preview?.id !== selected.id && <button className="selected-summary" onClick={() => setPreview(selected)}><span className="small">✓ 선택한 필수 방문 장소</span><strong>{selected.name}</strong><span className="small">선택한 장소 확인 ↗</span></button>}
      <p className="scope-note">장소를 고르면 날짜·시간·예산을 이어서 입력할 수 있어요.</p>
    </aside>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>;
}
