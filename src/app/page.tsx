export default function Home() {
  return (
    <main className="flex-1 flex items-center justify-center relative w-full h-full">
      <div className="glass-panel-heavy p-8 text-center max-w-lg mx-4 flex flex-col gap-4">
        <h1 className="text-4xl md:text-5xl font-outfit font-extrabold text-glow-primary text-[var(--accent-primary)]">
          Rolling Thunder
        </h1>
        <p className="text-[var(--text-secondary)] text-sm md:text-base leading-relaxed">
          물리 엔진 기반 하이엔드 무작위 추첨 웹 애플리케이션에 오신 것을 환영합니다.
          현재 초기 환경 설정(Phase 1)이 완료된 상태입니다.
        </p>
      </div>
    </main>
  );
}
