import type { Metadata } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

const pressStart2P = Press_Start_2P({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-headline',
});

const vt323 = VT323({
  subsets: ['latin'],
  weight: ['400'],
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
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={cn("font-body antialiased", pressStart2P.variable, vt323.variable)}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
