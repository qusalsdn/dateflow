"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoMap, type KakaoMaps } from "@/lib/kakao/maps-sdk";
import type { Place } from "@/lib/places/types";

export function PlaceMap({ places, activeId, onPreview }: {
  places: Place[]; activeId: string | null; onPreview: (place: Place) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<{ map: KakaoMap; sdk: KakaoMaps } | null>(null);
  const pins = useRef<{ id: string; button: HTMLButtonElement; overlay: InstanceType<KakaoMaps["CustomOverlay"]> }[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const key = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY;

  useEffect(() => {
    if (!key || !container.current) return;
    const element = container.current;
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    loadKakaoMaps(key).then((sdk) => {
      if (cancelled) return;
      const map = new sdk.Map(element, { center: new sdk.LatLng(37.5665, 126.978), level: 7 });
      instance.current = { sdk, map };
      observer = new ResizeObserver(() => {
        const center = map.getCenter();
        map.relayout();
        map.setCenter(center);
      });
      observer.observe(element);
      setState("ready");
    }).catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; observer?.disconnect(); instance.current = null; element.replaceChildren(); };
  }, [key, attempt]);

  useEffect(() => {
    if (state !== "ready" || !instance.current || !places.length) return;
    const { sdk, map } = instance.current;
    const bounds = new sdk.LatLngBounds();
    places.forEach((place) => bounds.extend(new sdk.LatLng(place.latitude, place.longitude)));
    if (places.length === 1) {
      map.setCenter(new sdk.LatLng(places[0].latitude, places[0].longitude));
      map.setLevel(4);
    } else map.setBounds(bounds);
  }, [places, state]);

  useEffect(() => {
    if (state !== "ready" || !instance.current) return;
    const { sdk, map } = instance.current;
    const overlays = places.map((place, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "map-pin";
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `${index + 1}. ${place.name} 위치 확인`);
      button.onclick = () => onPreview(place);
      const overlay = new sdk.CustomOverlay({ map, position: new sdk.LatLng(place.latitude, place.longitude), content: button, yAnchor: 1, zIndex: 1, clickable: true });
      return { id: place.id, button, overlay };
    });
    pins.current = overlays;
    return () => { overlays.forEach(({ overlay }) => overlay.setMap(null)); pins.current = []; };
  }, [places, onPreview, state]);

  useEffect(() => {
    pins.current.forEach(({ id, button, overlay }) => {
      const active = id === activeId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      overlay.setZIndex(active ? 3 : 1);
    });
    const active = places.find((place) => place.id === activeId);
    if (active && instance.current) {
      const { sdk, map } = instance.current;
      map.setCenter(new sdk.LatLng(active.latitude, active.longitude));
    }
  }, [activeId, places, state]);

  return <div className="map-frame">
    <div ref={container} className="map-canvas" role="region" aria-label="검색한 장소의 카카오 지도" />
    {(!key || state !== "ready") && <div className="map-message" role="status">
      <span className="map-cross" aria-hidden="true">＋</span>
      <p>{key && state === "loading" ? "지도를 불러오고 있어요" : "지도를 불러오지 못했어요"}</p>
      {(!key || state === "error") && <>
        <span>장소 선택은 계속할 수 있어요.<br />상세 정보의 카카오맵 링크로 위치를 확인해 주세요.</span>
        {key && <button className="text-button" onClick={() => { setState("loading"); setAttempt((value) => value + 1); }}>지도 다시 불러오기</button>}
      </>}
    </div>}
  </div>;
}
