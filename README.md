# 🎳 Rolling Thunder

> **물리 엔진 기반 하이엔드 무작위 추첨 웹 애플리케이션**

Rolling Thunder는 단순한 룰렛이나 사다리 타기의 지루함을 탈피하여, 다이내믹한 핀볼/마블 레이스 기믹과 고유 스킬 시스템을 접목한 프리미엄 무작위 추첨 웹 애플리케이션입니다.

## 📚 주요 문서 안내

프로젝트의 상세한 기획 및 개발 계획, 그리고 인수인계 정보는 다음 문서들을 확인해 주세요:

1. **[HANDOVER.md](./HANDOVER.md)**: 
   새로운 환경(데스크톱)에서 프로젝트를 세팅하고 개발을 시작하기 위한 **초기 환경 구축 가이드** 및 **인수인계 보고서**입니다.
2. **[PRD_Architecture.md](./PRD_Architecture.md)**:
   기획, UI/UX 와이어프레임, 아키텍처 설계, 물리 엔진 메커니즘, 스킬 밸런스 등 프로젝트의 **전체 요구사항 정의서(PRD)**입니다.

## 🚀 Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4, Framer Motion
- **Physics Engine**: Rapier.js (Rust/WASM 기반)
- **Backend/Auth**: Supabase
- **Deployment**: Vercel

## ✨ Key Features

- **압도적 물리 시뮬레이션**: Rapier.js를 활용한 수백 개의 칩 렌더링 및 복잡한 지형(장애물, 퍼널, 블랙홀) 시뮬레이션
- **6종의 고유 스킬 시스템**: 탱크, 슬라임, 유령화, 자석, 텔레포트, 부스터
- **프리미엄 디자인**: 다크/라이트 테마, 글래스모피즘, 화려한 마이크로 인터랙션
- **멀티 스테이지 서바이벌**: 여러 단계의 스테이지를 거쳐 최종 승자를 가리는 서바이벌 모드
