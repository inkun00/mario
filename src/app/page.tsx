import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Gamepad2, Lightbulb, Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import AppLogo from '@/components/app-logo';

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">로그인</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">회원가입</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="relative pt-16 h-[80vh] min-h-[600px] flex items-center justify-center text-center bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="absolute inset-0 overflow-hidden">
             <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary/20 rounded-full opacity-50 animate-blob"></div>
             <div className="absolute top-1/2 right-1/4 w-48 h-48 bg-accent/20 rounded-full opacity-50 animate-blob animation-delay-2000"></div>
             <div className="absolute bottom-1/4 left-1/2 w-24 h-24 bg-secondary rounded-full opacity-50 animate-blob animation-delay-4000"></div>
          </div>
          <div className="container relative px-4 md:px-6 z-10">
            <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              마리오 게임
            </h1>
            <p className="mx-auto max-w-[700px] text-foreground/80 md:text-xl mt-4">
              학습을 게임으로, 교실을 모험으로! 나만의 퀴즈를 만들고 친구들과 함께 즐겨보세요.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="font-headline">
                <Link href="/signup">게임 시작하기</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="font-headline">
                <Link href="#features">기능 둘러보기</Link>
              </Button>
            </div>
          </div>
        </section>
        
        <section id="features" className="py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl font-headline">주요 기능</h2>
              <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed mt-4">
                학습과 재미를 동시에 잡는 강력한 기능들을 만나보세요.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Lightbulb className="w-8 h-8 text-primary" />}
                title="나만의 퀴즈 제작"
                description="다양한 형식의 학습 퀴즈 세트를 쉽게 만들고 공유할 수 있습니다."
              />
              <FeatureCard
                icon={<Trophy className="w-8 h-8 text-primary" />}
                title="경험치 및 레벨 시스템"
                description="문제를 맞혀 경험치를 얻고 레벨을 올려 리더보드에 도전하세요."
              />
              <FeatureCard
                icon={<CheckCircle2 className="w-8 h-8 text-primary" />}
                title="오답 노트"
                description="틀린 문제는 오답 노트에서 다시 풀어보며 완벽하게 학습할 수 있습니다."
              />
            </div>
          </div>
        </section>

        <section className="py-12 md:py-24 lg:py-32 bg-secondary/50">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">
                지금 바로 교실을 게임 스테이지로 바꿔보세요!
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                간단한 회원가입 후 바로 당신만의 학습 게임을 시작할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

      </main>

      <footer className="bg-background border-t">
        <div className="container mx-auto py-6 px-4 md:px-6 flex justify-between items-center text-sm text-muted-foreground">
          <AppLogo />
          <p>&copy; {new Date().getFullYear()} 마리오 게임. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="text-center p-6 shadow-lg hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
      <CardHeader className="flex justify-center items-center mb-4">
        <div className="bg-primary/10 p-4 rounded-full">
          {icon}
        </div>
      </CardHeader>
      <CardTitle className="font-headline text-xl mb-2">{title}</CardTitle>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}
