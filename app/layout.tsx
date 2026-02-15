import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { TabNav } from './components/TabNav';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'UOJIN - LINE受注テキスト解析',
  description: 'LINEの受注メッセージを解析してスプレッドシートに登録するツール',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <TabNav />
        <main className="max-w-2xl mx-auto px-4 py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
