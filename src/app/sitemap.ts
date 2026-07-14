import type { MetadataRoute } from 'next'

/**
 * sitemap.xml — 검색 엔진에 크롤링 대상 페이지 목록 제공.
 * 비로그인 사용자에게 공개되는 페이지만 포함한다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://www.rollinthunder.net'

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
