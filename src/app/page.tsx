import type { Metadata } from 'next'
import LandingShell from '@/components/landing/LandingShell'
import LandingFooter from '@/components/landing/LandingFooter'
import { FeaturesSection, HowItWorksSection, TechSection } from '@/components/landing/LandingSections'
import FaqSection from '@/components/landing/FaqSection'
import { FAQ_ITEMS } from '@/components/landing/faqData'

export const metadata: Metadata = {
  title: 'Rolling Thunder — 리얼 무작위로 결정되는 공정한 추첨 레이스',
  description:
    '사다리타기는 이제 그만. 이름만 넣으면 진짜 랜덤으로 도파민 터지는 추첨 레이스가 시작됩니다. 설치 없이, 무료로, 브라우저에서 바로.',
  openGraph: {
    title: 'Rolling Thunder — 신나는 추첨 레이스',
    description: '리얼 무작위 추첨 레이스. 맵 에디터, 가챠 스킨, 미션까지 — 설치 없이 브라우저에서 바로.',
    url: '/',
  },
}

// 검색엔진 구조화 데이터 — FAQPage는 faqData 단일 소스에서 생성해 화면 노출 내용과 항상 일치시킨다.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Rolling Thunder',
      applicationCategory: 'GameApplication',
      operatingSystem: 'Web',
      description: '리얼 무작위 추첨 레이스 웹 애플리케이션. 맵 에디터, 커스텀 맵 스토어, 가챠 스킨, 미션 시스템 제공.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
      author: { '@type': 'Person', name: '찰떡쌤' },
      inLanguage: 'ko',
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ],
}

// 로그인 사용자는 미들웨어가 /dashboard로 보내므로, 이 페이지는 항상 비로그인 방문자용이다.
export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingShell
        sections={
          <>
            <FeaturesSection />
            <HowItWorksSection />
            <TechSection />
            <FaqSection />
          </>
        }
        footer={<LandingFooter />}
      />
    </>
  )
}
