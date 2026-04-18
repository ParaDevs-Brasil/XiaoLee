import type { Metadata } from "next";
import "./globals.css";
import { Quicksand } from "next/font/google";
import { ThemeProviderWrapper } from "../providers/ThemeProvider";

const quicksand = Quicksand({ 
  subsets: ["latin"], 
  variable: "--font-quicksand",
  weight: ["300", "400", "500", "600", "700"]
});

export const metadata: Metadata = {
    title: "✨ Xiaolee - Cute AI Chat 💖",
    description: "Um chat super fofo com uma assistente IA kawaii! (◕‿◕)♡",
    other: {
        'preload-video-1': '/xiaolee_cheer.mov',
        'preload-video-2': '/xiaolee_giggle.mp4',
        'preload-video-3': '/xiaolee_idle.mp4',
        'preload-video-4': '/xiaolee_wave.mp4',
        'preload-video-5': '/xiaolee_kawaii.mov',
        'preload-video-6': '/xiaolee_love.mp4',
        'preload-video-7': '/xiaolee_ola.mov',
        'preload-video-8': '/xiaolee_standby.mov',
        'preload-video-9': '/xiaolee_standby2.mov',
        'preload-video-10': '/xiaolee_standby3.mov',
        'preload-video-11': '/xiaolee_surprise.mov',
        'preload-video-12': '/xiaolee_thinklow.mov',
        'preload-video-13': '/xiaolee_uncomfortable.mov',
        'preload-video-14': '/xiaolee_ouch.mov',
        'preload-video-15': '/xiaolee_salute.mov'
    }
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
            <head>
                <link rel="preload" as="video" href="/xiaolee_cheer.mov" />
                <link rel="preload" as="video" href="/xiaolee_giggle.mp4" />
                <link rel="preload" as="video" href="/xiaolee_kawaii.mov" />
                <link rel="preload" as="video" href="/xiaolee_love.mp4" />
                <link rel="preload" as="video" href="/xiaolee_ola.mov" />
                <link rel="preload" as="video" href="/xiaolee_standby.mov" />
                <link rel="preload" as="video" href="/xiaolee_standby2.mov" />
                <link rel="preload" as="video" href="/xiaolee_standby3.mov" />
                <link rel="preload" as="video" href="/xiaolee_surprise.mov" />
                <link rel="preload" as="video" href="/xiaolee_thinklow.mov" />
                <link rel="preload" as="video" href="/xiaolee_uncomfortable.mov" />
                <link rel="preload" as="video" href="/xiaolee_ouch.mov" />
                <link rel="preload" as="video" href="/xiaolee_salute.mov" />
                </head>
                <body className={quicksand.className}>
                <ThemeProviderWrapper>
                    {children}
                </ThemeProviderWrapper>
            </body>
        </html>
    );
}