import { PlaceSearch } from "@/components/places/place-search";
import Link from "next/link";

export default function Home() {
  return <div className="app-shell">
    <a href="#main" className="skip-link">장소 검색으로 건너뛰기</a>
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Dateflow 처음으로">dateflow<span>.</span></Link>
      <Link href="/courses" className="header-caption">내 코스</Link>
    </header>
    <main id="main"><PlaceSearch /></main>
    <footer className="site-footer"><span>Dateflow</span><span>가고 싶은 곳에서, 함께할 하루로.</span></footer>
  </div>;
}
