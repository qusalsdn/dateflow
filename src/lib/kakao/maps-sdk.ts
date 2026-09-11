type Coordinate = object;
type Bounds = { extend(point: Coordinate): void };
export type KakaoMap = {
  setBounds(bounds: Bounds): void;
  setCenter(point: Coordinate): void;
  getCenter(): Coordinate;
  setLevel(level: number): void;
  relayout(): void;
};
export type KakaoMaps = {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => Coordinate;
  LatLngBounds: new () => Bounds;
  Map: new (container: HTMLElement, options: { center: Coordinate; level: number }) => KakaoMap;
  CustomOverlay: new (options: { map: KakaoMap; position: Coordinate; content: HTMLElement; yAnchor: number; zIndex: number; clickable: boolean }) => { setMap(map: KakaoMap | null): void; setZIndex(zIndex: number): void };
};

let loading: Promise<KakaoMaps> | undefined;

export function loadKakaoMaps(key: string): Promise<KakaoMaps> {
  if (loading) return loading;
  loading = new Promise<KakaoMaps>((resolve, reject) => {
    const script = document.createElement("script");
    const timer = window.setTimeout(fail, 12_000);
    function fail() {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Map SDK unavailable"));
    }
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    script.async = true;
    script.onerror = fail;
    script.onload = () => {
      const sdk = (window as Window & { kakao?: { maps?: KakaoMaps } }).kakao?.maps;
      if (!sdk) return fail();
      sdk.load(() => { window.clearTimeout(timer); resolve(sdk); });
    };
    document.head.appendChild(script);
  }).catch((error) => { loading = undefined; throw error; });
  return loading;
}
