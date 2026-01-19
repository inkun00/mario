import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-body',
});


export const metadata: Metadata = {
  title: '에듀칩(EduChip)',
  description: '학생과 교사를 위한 재미있고 상호작용적인 학습 게임 플랫폼입니다.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={cn("font-body antialiased", notoSansKR.variable)}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
