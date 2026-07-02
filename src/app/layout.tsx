import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from 'sonner';
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import GlobalAudioUnlocker from "@/components/GlobalAudioUnlocker";
import GlobalPlayerHUD from "@/components/GlobalPlayerHUD";
import JackpotEffect from "@/components/JackpotEffect";

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

import { getProfileOverviewAction } from "@/presentation/actions/profileActions";
import MissionSyncManager from "@/components/MissionSyncManager";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#101217", // Matches --bg-primary
};

export const metadata: Metadata = {
  title: "Rolling Thunder | 도파민 터지는 레이스",
  description: "Premium dynamic marble race and physics simulation game.",
  manifest: "/manifest.json",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const profile = await getProfileOverviewAction();

  return (
    <html lang="ko" className={`${outfit.variable} ${jetbrainsMono.variable} ${customFonts}`}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
        <ThemeProvider>
          <GlobalAudioUnlocker>
            {children}
            <MissionSyncManager userId={profile?.id} />
            <GlobalPlayerHUD initialProfile={profile} />
            <JackpotEffect />
            <Toaster theme="dark" position="bottom-right" />
          </GlobalAudioUnlocker>
        </ThemeProvider>
      </body>
    </html>
  );
}
