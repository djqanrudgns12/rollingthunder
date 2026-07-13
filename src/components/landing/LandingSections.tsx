import { Sparkles, Map, Palette, Trophy, MonitorPlay, Vibrate } from 'lucide-react'
import Reveal from './Reveal'

/** 기능 쇼케이스 — 선생님들(초등교사)을 위한 친근하고 직관적인 설명으로 개편 */
const FEATURES = [
  {
    icon: Sparkles,
    color: 'from-amber-400 to-orange-500',
    bg: 'bg-orange-500/10',
    title: '아이들이 납득하는 공정한 추첨',
    desc: '눈속임 없이 진짜 물리 법칙으로 굴러갑니다. "선생님 조작 아니에요?"라는 말 쏙 들어가게, 매 판이 투명하고 정직하게 결정돼요.',
  },
  {
    icon: Map,
    color: 'from-cyan-400 to-blue-500',
    bg: 'bg-blue-500/10',
    title: '우리 반만의 특별한 맵 만들기',
    desc: '원하는 곳에 장애물을 직접 배치해서 맵을 만들어보세요. 다른 선생님들이 만든 기발하고 재밌는 맵을 가져와서 바로 쓸 수도 있어요.',
  },
  {
    icon: Palette,
    color: 'from-pink-400 to-rose-500',
    bg: 'bg-rose-500/10',
    title: '귀여운 스킨으로 시선 집중',
    desc: '단순한 구슬이 아닙니다. 학생들이 꺄르르 웃을 만한 다양하고 귀여운 칩 스킨들이 준비되어 있어요. 뽑을 때마다 환호성이 터집니다.',
  },
  {
    icon: Trophy,
    color: 'from-emerald-400 to-green-500',
    bg: 'bg-green-500/10',
    title: '소소한 재미를 더하는 미션',
    desc: '출석 체크하듯, 매일매일 추첨기를 켜고 돌리기만 해도 작은 보상들이 쌓입니다. 선생님의 소소한 재미를 챙겨드려요.',
  },
  {
    icon: MonitorPlay,
    color: 'from-purple-400 to-indigo-500',
    bg: 'bg-indigo-500/10',
    title: '수업에 방해 없는 차분한 화면',
    desc: '빛 번짐이나 화려한 움직임이 부담스러울 때가 있죠. 교실 TV나 프로젝터에 띄워두기 딱 좋은 \'차분한 모드\'로 눈을 편안하게 지켜주세요.',
  },
  {
    icon: Vibrate,
    color: 'from-sky-400 to-cyan-500',
    bg: 'bg-sky-500/10',
    title: '판 흔들기로 교실이 들썩',
    desc: '레이스 도중 화면을 꾹 눌러 판을 흔들어보세요! 칩들이 우르르 뒤집어지며 순위가 뒤바뀝니다. 아이들의 환호와 비명이 동시에 터져요.',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-16 border-t border-[var(--panel-border)] relative">
      {/* 배경 장식 */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--accent-primary)]/50 to-transparent" />
      
      <div className="max-w-6xl mx-auto px-5 py-24">
        <Reveal>
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 mb-4 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-sm font-bold tracking-wide">
            FOR TEACHERS
          </div>
          <h2 className="font-outfit font-bold text-3xl sm:text-4xl md:text-5xl text-[var(--text-primary)] tracking-tight">
            구경만 하는 추첨은 시시하니까
          </h2>
          <p className="mt-5 text-lg text-[var(--text-secondary)]">
            선생님들의 학급 경영에 <strong className="text-white font-semibold">진짜 재미</strong>를 더해줄 기능들만 모았습니다.
          </p>
        </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08}>
            <div
              className="group relative h-full rounded-2xl glass-panel p-8 overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(0,0,0,0.4)] hover:border-white/20 cursor-default"
            >
              {/* 카드 내부 글로우 이펙트 */}
              <div className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${f.color} rounded-full blur-[60px] opacity-10 group-hover:opacity-30 transition-opacity duration-500`} />
              
              <div className={`relative z-10 w-14 h-14 rounded-2xl ${f.bg} border border-white/5 flex items-center justify-center mb-6 shadow-inner group-hover:scale-110 transition-transform duration-300`}>
                <f.icon className="w-7 h-7 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              </div>
              
              <h3 className="relative z-10 text-xl font-bold text-[var(--text-primary)] mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-400 transition-all">
                {f.title}
              </h3>
              
              <p className="relative z-10 text-[15px] text-[var(--text-secondary)] leading-relaxed font-medium">
                {f.desc}
              </p>
            </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    no: '01',
    title: '우리 반 명단, 1초 만에 쓱-',
    desc: '엑셀에 있는 이름들 그대로 복사해서 붙여넣으세요! 한 번 입력한 명단은 그룹으로 저장되어, 다음번엔 클릭 한 번으로 불러옵니다.',
    visual: (
      <div className="relative rounded-xl bg-black/40 border border-white/10 p-4 overflow-hidden h-36 flex flex-col justify-between group-hover:border-[var(--accent-primary)]/50 transition-colors">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-1 rounded">새 레이스</span>
          <span className="text-[10px] text-white/40 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
            저장된 명단 불러오기
          </span>
        </div>
        <div className="flex-1 rounded bg-black/50 border border-white/5 p-3 text-left text-sm font-mono text-[var(--text-primary)] leading-relaxed relative">
          <span className="text-blue-300">지민</span>, <span className="text-pink-300">서연</span>, <span className="text-green-300">민준</span>, 
          <br />
          <span className="text-yellow-300">도윤</span>, <span className="text-purple-300">하은</span><span className="inline-block w-2 h-4 bg-[var(--accent-primary)] align-middle animate-pulse ml-1 shadow-[0_0_8px_var(--accent-primary)]" />
        </div>
      </div>
    ),
  },
  {
    no: '02',
    title: '오늘의 맵과 스킨은 내가 고른다!',
    desc: '대기실에서 가장 핫한 시간! 블랙홀 맵? 귀여운 동물 스킨? 장애물 밀도 슬라이더를 쫙 올려서 매운맛 레이스도 만들어보세요!',
    visual: (
      <div className="relative rounded-xl bg-black/40 border border-white/10 p-4 overflow-hidden h-36 flex flex-col gap-3 group-hover:border-[var(--accent-secondary)]/50 transition-colors">
        <div className="flex gap-2">
          {['🌪️ 토네이도', '🕳️ 블랙홀'].map((map, i) => (
            <div key={i} className={`text-xs px-2 py-1.5 rounded border ${i === 0 ? 'bg-[var(--accent-secondary)]/20 border-[var(--accent-secondary)]/50 text-white' : 'bg-black/50 border-white/10 text-white/50'}`}>
              {map}
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-white/60 mb-1">
            <span>장애물 매운맛 조절</span>
            <span className="text-[#ff4d4f] font-bold">MAX!</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden relative">
            <div className="absolute top-0 left-0 h-full w-[85%] bg-gradient-to-r from-yellow-400 to-[#ff4d4f] rounded-full" />
          </div>
        </div>
        <div className="flex justify-between items-center mt-auto">
          <span className="text-xs text-white/60">참가자 24명</span>
          <div className="flex -space-x-2">
            {['🐱', '🐶', '🐰', '🐼'].map((skin, i) => (
              <div key={i} className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] backdrop-blur-sm z-10">{skin}</div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    no: '03',
    title: '아드레날린 폭발! GAME START',
    desc: '준비가 끝났다면 버튼을 누르세요. 칩들이 쏟아지는 순간 긴장감과 환호성이 가득 찹니다. 꼴찌가 1등을 뺏는 짜릿한 드라마가 시작돼요!',
    visual: (
      <div className="relative rounded-xl bg-black/40 border border-white/10 p-4 h-36 flex items-center justify-center group-hover:border-[#00ffcc]/50 transition-colors overflow-hidden">
        {/* 폭죽 파티클 애니메이션 대용 */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
           <div className="absolute top-2 left-4 text-xs animate-bounce text-yellow-300">✨</div>
           <div className="absolute bottom-4 right-6 text-sm animate-ping text-pink-400">🎉</div>
           <div className="absolute top-8 right-8 text-xs animate-bounce text-cyan-300 delay-100">⭐️</div>
        </div>
        
        <div className="relative w-full max-w-[180px]">
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] rounded-lg blur opacity-75 group-hover:opacity-100 transition duration-200 animate-pulse"></div>
          <button className="relative w-full rounded-lg py-3.5 text-center font-extrabold tracking-widest text-black bg-gradient-to-r from-[var(--accent-primary)] to-[#00ffcc] shadow-[0_0_20px_rgba(0,255,204,0.5)] transform group-hover:scale-105 transition-transform duration-200">
            GAME START
          </button>
        </div>
      </div>
    ),
  },
]

export function HowItWorksSection() {
  return (
    <section id="how" className="scroll-mt-16 border-t border-[var(--panel-border)] relative overflow-hidden bg-gradient-to-b from-black/0 via-black/20 to-black/0">
      
      <div className="max-w-6xl mx-auto px-5 py-28 relative z-10">
        <Reveal>
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 mb-4 rounded-full border border-[var(--accent-secondary)]/30 bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] text-sm font-bold tracking-wide">
            EASY TO USE
          </div>
          <h2 className="font-outfit font-bold text-3xl sm:text-4xl md:text-5xl text-[var(--text-primary)] tracking-tight">
            딱 30초면 준비 끝!
          </h2>
          <p className="mt-5 text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            복잡한 설정은 덜어내고 <strong className="text-white font-semibold">도파민 터지는 짜릿함</strong>만 남겼습니다. <br className="hidden sm:block"/>회원가입 없이도 지금 바로 체험해보세요.
          </p>
        </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <Reveal key={s.no} delay={i * 0.1} className="h-full">
            <div className="group h-full glass-panel p-7 flex flex-col gap-5 hover:-translate-y-2 transition-transform duration-300">
              <div className="flex items-center gap-3 mb-1">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-mono font-bold text-sm border border-[var(--accent-primary)]/20 shadow-[0_0_10px_rgba(0,255,204,0.1)]">
                  {s.no}
                </span>
                <h3 className="font-bold text-xl text-[var(--text-primary)]">{s.title}</h3>
              </div>
              
              {s.visual}
              
              <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed font-medium">
                {s.desc}
              </p>
            </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const TECH = [
  { name: 'Next.js 15', color: 'from-gray-300 to-white' },
  { name: 'React 19', color: 'from-cyan-400 to-blue-500' },
  { name: 'Rapier · Rust → WASM', color: 'from-orange-400 to-red-500' },
  { name: 'PixiJS 8', color: 'from-pink-400 to-rose-500' },
  { name: 'Supabase', color: 'from-emerald-400 to-green-500' },
  { name: 'Tailwind CSS 4', color: 'from-sky-400 to-cyan-400' },
  { name: 'PWA', color: 'from-purple-400 to-indigo-500' },
]

export function TechSection() {
  return (
    <section className="border-t border-[var(--panel-border)] relative overflow-hidden">
      {/* 은은한 배경 글로우 */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--accent-secondary)]/5 to-transparent pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-5 py-20 text-center relative z-10">
        <Reveal>
        <h3 className="font-outfit font-bold text-2xl text-[var(--text-primary)] mb-3">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]">POWERED BY</span> MODERN STACK
        </h3>
        <p className="text-sm text-[var(--text-secondary)] mb-10">
          장난감처럼 보여도, 스택은 진지합니다.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {TECH.map((t) => (
            <div
              key={t.name}
              className="group relative px-4 py-2 rounded-full font-mono text-xs font-bold backdrop-blur-md bg-white/5 border border-white/10 hover:border-white/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(255,255,255,0.05)] cursor-default"
            >
              {/* 호버 시 퍼지는 배경 그라데이션 */}
              <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-15 transition-opacity duration-300 bg-gradient-to-r ${t.color}`} />
              
              {/* 텍스트 그라데이션 */}
              <span className={`relative z-10 text-transparent bg-clip-text bg-gradient-to-r ${t.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
                {t.name}
              </span>
            </div>
          ))}
        </div>
        </Reveal>
      </div>
    </section>
  )
}
