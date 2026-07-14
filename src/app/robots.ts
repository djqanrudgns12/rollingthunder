import type { MetadataRoute } from 'next'

/**
 * robots.txt — 검색 엔진 크롤러 접근 규칙.
 * 공개 페이지(랜딩, 약관, 개인정보처리방침)만 허용하고
 * 로그인 전용 영역(대시보드, 에디터, API 등)은 차단한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/admin/', '/dashboard/', '/editor/', '/shop/', '/gacha/', '/profile/'],
    },
    sitemap: 'https://www.rollinthunder.net/sitemap.xml',
  }
}
