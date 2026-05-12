import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proof, please! — Indie Pool",
  description:
    "AI-verified, soulbound reputation infrastructure for creators on Solana. Submit creative work, get AI-scored, earn non-transferable on-chain reputation + automatic SOL payouts.",
  applicationName: "Proof, please!",
  // Next.js auto-uses app/icon.png and app/favicon.ico — no manual `icons`
  // field needed. Listing OG + Twitter cards so the logo shows up when the
  // dApp URL is pasted in Discord / Twitter / Slack previews.
  openGraph: {
    title: "Proof, please!",
    description:
      "AI-verified, soulbound reputation infrastructure for creators on Solana.",
    images: [
      {
        url: "/indie-pool-logo.png",
        width: 1536,
        height: 1024,
        alt: "Proof, please! — Indie Pool",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Proof, please!",
    description:
      "AI-verified, soulbound reputation infrastructure for creators on Solana.",
    images: ["/indie-pool-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-rep-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
