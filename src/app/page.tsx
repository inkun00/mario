import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Gamepad2, Lightbulb, Trophy, Gem, Users, Store } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import AppLogo from '@/components/app-logo';
import { MotionDiv } from '@/components/motion-div';

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
             <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full animate-blob animation-delay-1000" />
             <div className="absolute -top-40 -right-40 w-80 h-80 bg-accent/5 rounded-full animate-blob animation-delay-2000" />
          </div>
          <MotionDiv
            className="container relative px-4 md:px-6 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-5xl md:text-6xl lg:text-7xl">
              에듀칩(EduChip)
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-4">
              학습으로 자산을 모으고, 교실을 경제활동의 장으로 만들어 보세요.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
              <Button size="lg" asChild className="font-headline">
                <Link href="/signup">게임 시작하기</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="font-headline">
                <Link href="#features">기능 둘러보기</Link>
              </Button>
            </div>
          </MotionDiv>
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
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <FeatureCard
                  icon={<Lightbulb className="w-8 h-8 text-primary" />}
                  title="나만의 퀴즈 제작"
                  description="다양한 형식의 학습 퀴즈 세트를 쉽게 만들고 공유할 수 있습니다."
                />
              </MotionDiv>
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <FeatureCard
                  icon={<Trophy className="w-8 h-8 text-primary" />}
                  title="경험치 및 레벨 시스템"
                  description="문제를 맞혀 경험치를 얻고 레벨을 올려 리더보드에 도전하세요."
                />
              </MotionDiv>
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <FeatureCard
                  icon={<CheckCircle2 className="w-8 h-8 text-primary" />}
                  title="오답 노트"
                  description="틀린 문제는 오답 노트에서 다시 풀어보며 완벽하게 학습할 수 있습니다."
                />
              </MotionDiv>
               <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <FeatureCard
                  icon={<Gem className="w-8 h-8 text-primary" />}
                  title="학습 보상으로 포인트 획득"
                  description="친구들과 퀴즈를 풀고 학급 포인트를 얻을 수 있습니다."
                />
              </MotionDiv>
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <FeatureCard
                  icon={<Users className="w-8 h-8 text-primary" />}
                  title="퀴즈 크리에이터 활동"
                  description="자신이 만든 퀴즈를 다른 친구들이 이용할수록 포인트 보상을 얻을 수 있습니다."
                />
              </MotionDiv>
              <MotionDiv
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
              >
                <FeatureCard
                  icon={<Store className="w-8 h-8 text-primary" />}
                  title="학급 매점"
                  description="획득한 포인트를 활용하여 학급 매점에서 판매되고 있는 상품을 구입할 수 있습니다."
                />
              </MotionDiv>
            </div>
          </div>
        </section>

        <section className="py-12 md:py-24 lg:py-32 bg-secondary">
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
          <p>&copy; {new Date().getFullYear()} 에듀칩(EduChip). All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="text-center p-6 shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300 h-full">
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
