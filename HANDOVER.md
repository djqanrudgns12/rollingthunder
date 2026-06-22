# 🤝 Rolling Thunder — 인수인계 및 초기 설정 가이드

본 문서는 새로운 개발 환경(다른 데스크톱 등)에서 `Rolling Thunder` 프로젝트를 클론받아 즉시 개발을 시작할 수 있도록 돕는 상세 가이드입니다.

---

## 1. 프로젝트 초기화 (Boilerplate 생성)

현재 이 저장소에는 기획 문서만 존재합니다. 코딩을 시작하기 위해 제일 먼저 Next.js 프로젝트를 설정해야 합니다.

터미널을 열고 다음 명령어를 순서대로 실행하세요:

```bash
# 1. Next.js 15 + Tailwind CSS v4 설치 (현재 폴더에 초기화)
npx -y create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-npm

# 2. 필수 라이브러리 설치
npm install @dimforge/rapier2d-compat framer-motion zustand @supabase/supabase-js @supabase/ssr lucide-react clsx tailwind-merge
```

---

## 2. Supabase 연동 및 DB 세팅

프로젝트는 데이터베이스 및 인증 레이어로 Supabase를 사용합니다.

1. **Supabase 프로젝트 생성**: [Supabase 대시보드](https://supabase.com/)에서 새 프로젝트(`rolling-thunder`)를 생성합니다.
2. **인증 설정**: `Authentication` -> `Providers`에서 **Email** 공급자를 활성화하고, 기획에 따라 'username' 등 추가 메타데이터를 받을 수 있도록 세팅합니다.
3. **환경 변수 등록**: 프로젝트 루트에 `.env.local` 파일을 생성하고 키를 입력합니다.
   ```env
   NEXT_PUBLIC_SUPABASE_URL=당신의_프로젝트_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=당신의_ANON_KEY
   ```
4. **SQL 마이그레이션**: `PRD_Architecture.md`의 데이터베이스 스키마(profiles, sessions, participants 등)를 기반으로 Supabase의 SQL Editor를 이용해 테이블을 생성합니다.

---

## 3. Vercel 배포 파이프라인 연동

초기부터 CI/CD를 구축하여 개발 편의성을 극대화합니다.

1. **Vercel 연동**: [Vercel 대시보드](https://vercel.com/)에서 `Add New...` -> `Project`를 클릭합니다.
2. **저장소 선택**: 현재 GitHub 저장소(`djqanrudgns12/rollingthunder`)를 임포트합니다.
3. **환경 변수**: Supabase에서 발급받은 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 환경 변수로 등록합니다.
4. **배포**: `Deploy` 버튼을 눌러 초기 빌드가 성공하는지 확인합니다.

---

## 4. 물리 엔진 (Rapier.js) 개발 시 주의사항

기존 `Matter.js` 기획에서 최신 `Rapier.js(WASM)`로 전환되었습니다. 구현 시 다음 사항을 반드시 지켜주세요.

1. **비동기 초기화**: Rapier.js는 WASM 모듈이므로 클라이언트 컴포넌트(`'use client'`) 내의 `useEffect`에서 비동기로(`await RAPIER.init()`) 로드해야 Next.js SSR 에러가 발생하지 않습니다.
2. **번들러 호환성**: Next.js 환경과의 충돌을 피하기 위해 반드시 `@dimforge/rapier2d-compat` 패키지를 사용하세요.
3. **스킬 쿨타임 및 루프**: `자석` 스킬의 경우, 내장된 attract 속성이 없으므로 매 프레임(step)마다 물리 캔버스 내부 루프에서 주변 칩의 거리를 계산하여 `applyForce`를 수동으로 적용해야 합니다.
4. **CCD 활성화**: 칩이 벽을 뚫고 나가는(터널링) 현상을 막기 위해 빠른 물체에는 `rigidBodyDesc.setCcdEnabled(true)`를 꼭 적용하세요.

---

## 5. 작업 우선순위 (Phase 1 ~ 3 권장)

새로운 PC에서 세팅을 마친 후 다음 순서로 개발을 진행하는 것을 권장합니다:
- **Phase 1**: 보일러플레이트 세팅 및 Tailwind CSS 기반의 프리미엄 테마(CSS 변수) 뼈대 구축
- **Phase 2**: Supabase Auth 연동 및 로그인/회원가입 UI 작성
- **Phase 3**: Rapier.js 캔버스 띄우기 및 칩 떨어뜨리기 기초 물리 테스트

상세한 기획 및 와이어프레임 구조는 `PRD_Architecture.md` 파일을 참조하세요.
