import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased min-h-[100dvh] w-full flex flex-col overflow-hidden bg-[var(--bg-primary)]">
        {children}
        <Toaster theme="dark" position="bottom-right" />
      </body>
    </html>
  );
}
