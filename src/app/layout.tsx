import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from 'sonner';
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import GlobalAudioUnlocker from "@/components/GlobalAudioUnlocker";
import GlobalPlayerHUD from "@/components/GlobalPlayerHUD";
import JackpotEffect from "@/components/JackpotEffect";
import GlobalModals from "@/components/GlobalModals";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const bmdohyeon = localFont({ src: '../../public/fonts/BMDOHYEON.woff2', variable: '--font-bmdohyeon', preload: false });
const bmeuljiro = localFont({ src: '../../public/fonts/BMEULJIROTTF.woff2', variable: '--font-bmeuljiro', preload: false });
const bmjua = localFont({ src: '../../public/fonts/BMJUA.woff2', variable: '--font-bmjua', preload: false });
const bmyeonsung = localFont({ src: '../../public/fonts/BMYEONSUNG_ttf.woff2', variable: '--font-bmyeonsung', preload: false });
const cafe24dongdong = localFont({ src: '../../public/fonts/Cafe24Dongdong.woff2', variable: '--font-cafe24dongdong', preload: false });
const cafe24ssukssuk = localFont({ src: '../../public/fonts/Cafe24Ssukssuk.woff2', variable: '--font-cafe24ssukssuk', preload: false });
const jnaughtyl = localFont({ src: '../../public/fonts/JNaughtyL.woff2', variable: '--font-jnaughtyl', preload: false });
const jnaughtym = localFont({ src: '../../public/fonts/JNaughtyM.woff2', variable: '--font-jnaughtym', preload: false });
const kccganpan = localFont({ src: '../../public/fonts/KCC-Ganpan.woff2', variable: '--font-kccganpan', preload: false });
const kccdodam = localFont({ src: '../../public/fonts/KCCDodamdodam.woff2', variable: '--font-kccdodam', preload: false });
const maplestoryb = localFont({ src: '../../public/fonts/MaplestoryB.woff2', variable: '--font-maplestoryb', preload: false });
const maplestoryl = localFont({ src: '../../public/fonts/MaplestoryL.woff2', variable: '--font-maplestoryl', preload: false });
const ownglyph2022 = localFont({ src: '../../public/fonts/Ownglyph2022.woff2', variable: '--font-ownglyph2022', preload: false });
const ridibatang = localFont({ src: '../../public/fonts/RIDIBatang.woff2', variable: '--font-ridibatang', preload: false });
const schoolsafeb = localFont({ src: '../../public/fonts/SchoolSafeNadeuriB.woff2', variable: '--font-schoolsafeb', preload: false });
const schoolsafel = localFont({ src: '../../public/fonts/SchoolSafeNadeuriL.woff2', variable: '--font-schoolsafel', preload: false });

const customFonts = `${bmdohyeon.variable} ${bmeuljiro.variable} ${bmjua.variable} ${bmyeonsung.variable} ${cafe24dongdong.variable} ${cafe24ssukssuk.variable} ${jnaughtyl.variable} ${jnaughtym.variable} ${kccganpan.variable} ${kccdodam.variable} ${maplestoryb.variable} ${maplestoryl.variable} ${ownglyph2022.variable} ${ridibatang.variable} ${schoolsafeb.variable} ${schoolsafel.variable}`;

import MissionSyncManager from "@/components/MissionSyncManager";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#101217", // Matches --bg-primary
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.rollinthunder.net'),
  title: {
    default: 'Rolling Thunder | 신나는 추첨 레이스',
    template: '%s | Rolling Thunder',
  },
  description: '리얼 무작위 추첨 레이스. 이름만 넣으면 도파민 터지는 레이스가 시작됩니다. 설치 없이, 무료로, 브라우저에서 바로.',
  manifest: '/manifest.json',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Rolling Thunder',
    images: [{ url: '/images/og-cover.png', width: 1200, height: 630, alt: 'Rolling Thunder — 신나는 추첨 레이스' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/images/og-cover.png'],
  },
  icons: {
    icon: '/icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${outfit.variable} ${jetbrainsMono.variable} ${customFonts}`}>
      <head>
        {/* CDN 연결 선(preconnect)으로 폰트 CSS 왕복 지연 단축. as="style"은 stylesheet 링크에
            무효(preload 전용 속성)라 제거 — 브라우저 콘솔 경고/무시 대상이었음 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
        <ThemeProvider>
          <GlobalAudioUnlocker>
            {children}
            {/* [최적화] 초기 렌더링 블로킹 방지를 위해 서버 프로필 연동을 제거하고 클라이언트 컴포넌트에 위임 */}
            <MissionSyncManager />
            <GlobalPlayerHUD />
            <JackpotEffect />
            <GlobalModals />
            <Toaster theme="dark" position="bottom-right" />
          </GlobalAudioUnlocker>
        </ThemeProvider>
      </body>
    </html>
  );
}
