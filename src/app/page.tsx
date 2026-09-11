import { SERVICE_CONFIG } from "@/lib/config";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col px-6 py-8 sm:px-12">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <span className="text-xl font-bold tracking-tight">dateflow<span className="text-primary">.</span></span>
        <span className="rounded-full bg-secondary px-4 py-2 text-sm">{SERVICE_CONFIG.region}에서 만나요</span>
      </header>
      <section className="flex flex-1 flex-col justify-center py-20">
        <p className="mb-5 text-sm font-semibold tracking-widest text-primary">SEOUL DATE PLANNER</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">가고 싶은 곳 하나,<br />함께 보낼 하루의 시작.</h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">꼭 가고 싶은 장소를 중심으로, 걷고 쉬고 맛보는 서울 데이트 코스를 준비하고 있어요.</p>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            ["01", "장소에서 시작", "가보고 싶었던 곳을 하루의 중심으로"],
            ["02", "편하게 이동", "도보와 대중교통으로 이어지는 동선"],
            ["03", "다음에도 함께", "마음에 드는 코스는 저장하고 공유"],
          ].map(([number, title, description]) => (
            <div key={number} className="rounded-2xl border border-border bg-card p-6">
              <span className="text-sm font-semibold text-primary">{number}</span>
              <h2 className="mt-5 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">서비스 준비 중 · 장소 검색과 코스 생성은 아직 제공되지 않아요.</p>
      </section>
      <footer className="border-t border-border pt-6 text-sm text-muted-foreground">Dateflow · 우리의 다음 약속</footer>
    </main>
  );
}
