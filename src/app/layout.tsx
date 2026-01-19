import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daily Mood Tracker",
  description:
    "Log one emotion per day, add a note, and watch your trend line grow. Works with PostgreSQL + Prisma and has an admin dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-950 text-slate-100`}>
        <div className="min-h-screen bg-slate-950/95">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
              <Link href="/" className="font-semibold tracking-tight text-white">
                Daily Mood
              </Link>
              <NavBar />
            </div>
          </header>

          <main className="px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
