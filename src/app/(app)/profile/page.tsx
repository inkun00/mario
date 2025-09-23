'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import type { User, CorrectAnswer, IncorrectAnswer } from '@/lib/types';
import { doc, getDoc, collection, getDocs, updateDoc, increment, deleteDoc, Timestamp } from 'firebase/firestore';
import { BrainCircuit, Activity, FileWarning, Sparkles, Loader2, Lightbulb, CheckCircle, Trophy, School } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { getLevelInfo, getNextLevelInfo, LevelInfo, levelSystem } from '@/lib/level-system';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface ReviewQuestion extends IncorrectAnswer {
    newQuestion: string;
    isGenerating?: boolean;
    userReviewAnswer?: string;
    isChecking?: boolean;
    isCorrect?: boolean;
}

async function callApi(flow: string, input: any) {
  const response = await fetch('/api/genkit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow, input }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }
  return response.json();
}

export default function ProfilePage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState<CorrectAnswer[]>([]);
  const [incorrectAnswers, setIncorrectAnswers] = useState<IncorrectAnswer[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [analysis, setAnalysis] = useState<{strongAreas: string, weakAreas: string} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(true);
  const { toast } = useToast();

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [nextLevelInfo, setNextLevelInfo] = useState<LevelInfo | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch user data
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const fetchedUserData = userSnap.data() as User;
        setUserData(fetchedUserData);
        
        const currentLevel = getLevelInfo(fetchedUserData.xp);
        setLevelInfo(currentLevel);
        setNextLevelInfo(getNextLevelInfo(currentLevel.level));
      }

      // Fetch correct and incorrect answers
      const correctAnswersRef = collection(db, 'users', user.uid, 'correct-answers');
      const incorrectAnswersRef = collection(db, 'users', user.uid, 'incorrect-answers');
      
      const [correctSnapshot, incorrectSnapshot] = await Promise.all([
        getDocs(correctAnswersRef),
        getDocs(incorrectAnswersRef)
      ]);

      const correctData = correctSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CorrectAnswer));
      const incorrectData = incorrectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncorrectAnswer));

      setCorrectAnswers(correctData);
      setIncorrectAnswers(incorrectData);

      setReviewQuestions(incorrectData.map(q => ({...q, newQuestion: '', isGenerating: true})));

      setIsLoading(false);
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    if (isLoading || (correctAnswers.length === 0 && incorrectAnswers.length === 0)) {
      if (!isLoading) setIsAnalysisLoading(false);
      return;
    };
    
    const runAnalysis = async () => {
        setIsAnalysisLoading(true);
        try {
            const plainCorrectAnswers = correctAnswers.map(a => {
                const { id, ...rest } = a;
                return { ...rest, timestamp: a.timestamp instanceof Timestamp ? a.timestamp.toDate().toISOString() : a.timestamp };
            });
            const plainIncorrectAnswers = incorrectAnswers.map(a => {
                const { id, ...rest } = a;
                 return { ...rest, timestamp: a.timestamp instanceof Timestamp ? a.timestamp.toDate().toISOString() : a.timestamp };
            });

            const result = await callApi('analyzeLearning', { 
              correctAnswers: plainCorrectAnswers, 
              incorrectAnswers: plainIncorrectAnswers
            });
            setAnalysis(result);
        } catch (error) {
            console.error("Error analyzing learning data:", error);
            toast({ variant: 'destructive', title: '오류', description: '학습 데이터 분석 중 오류가 발생했습니다.'});
        } finally {
            setIsAnalysisLoading(false);
        }
    };

    runAnalysis();

  }, [isLoading, correctAnswers, incorrectAnswers, toast]);
  
  useEffect(() => {
    if (reviewQuestions.length > 0 && reviewQuestions.some(q => q.isGenerating)) {
        reviewQuestions.forEach(async (q) => {
            if(q.isGenerating) {
                try {
                    const result = await callApi('generateReviewQuestion', { originalQuestion: q.question });
                    setReviewQuestions(prev => prev.map(rq => 
                        rq.id === q.id ? {...rq, newQuestion: result.newQuestion, isGenerating: false} : rq
                    ));
                } catch (error) {
                    console.error("Error generating review question:", error);
                     setReviewQuestions(prev => prev.map(rq => 
                        rq.id === q.id ? {...rq, newQuestion: '문제 생성 실패', isGenerating: false} : rq
                    ));
                }
            }
        });
    }
  }, [reviewQuestions]);

  const handleReviewAnswerChange = (id: string, value: string) => {
      setReviewQuestions(prev => prev.map(rq => rq.id === id ? {...rq, userReviewAnswer: value} : rq));
  };

  const handleCheckAnswer = async (id: string) => {
      const questionToCheck = reviewQuestions.find(rq => rq.id === id);
      if (!questionToCheck || !questionToCheck.userReviewAnswer) {
          toast({ variant: 'destructive', title: '오류', description: '답을 입력해주세요.'});
          return;
      }

      setReviewQuestions(prev => prev.map(rq => rq.id === id ? {...rq, isChecking: true} : rq));

      try {
          const result = await callApi('checkReviewAnswer', {
              originalQuestion: questionToCheck.question,
              reviewQuestion: questionToCheck.newQuestion,
              userAnswer: questionToCheck.userReviewAnswer
          });

          if (result.isCorrect) {
              toast({ title: '정답입니다!', description: '10 보너스 포인트를 획득했습니다!'});
              if(user) {
                  const userRef = doc(db, 'users', user.uid);
                  await updateDoc(userRef, { xp: increment(10) });
                  const answerRef = doc(db, 'users', user.uid, 'incorrect-answers', id);
                  await deleteDoc(answerRef);
                  setReviewQuestions(prev => prev.filter(rq => rq.id !== id));
                  setUserData(prev => prev ? ({...prev, xp: prev.xp + 10}) : null); // Optimistic update
              }
          } else {
              toast({ variant: 'destructive', title: '오답입니다.', description: '다시 한번 생각해보세요!'});
              setReviewQuestions(prev => prev.map(rq => rq.id === id ? {...rq, isChecking: false} : rq));
          }
      } catch (error) {
          console.error("Error checking review answer:", error);
          toast({ variant: 'destructive', title: '오류', description: '정답 확인 중 오류가 발생했습니다.'});
          setReviewQuestions(prev => prev.map(rq => rq.id === id ? {...rq, isChecking: false} : rq));
      }
  };


  const totalQuestions = correctAnswers.length + incorrectAnswers.length;
  const correctRate = totalQuestions > 0 ? (correctAnswers.length / totalQuestions * 100).toFixed(1) : 0;
  
  const xpForNextLevel = nextLevelInfo ? nextLevelInfo.xpThreshold - (levelInfo?.xpThreshold || 0) : 0;
  const currentXpProgress = userData ? userData.xp - (levelInfo?.xpThreshold || 0) : 0;
  const progressPercentage = xpForNextLevel > 0 ? (currentXpProgress / xpForNextLevel) * 100 : 100;

  const schoolInfo = [userData?.schoolName, userData?.grade && `${userData.grade}학년`, userData?.class && `${userData.class}반`].filter(Boolean).join(' ');

  if (isLoading) {
    return (
        <div className="container mx-auto flex flex-col gap-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <div>
                           <Skeleton className="h-8 w-40 mb-2" />
                           <Skeleton className="h-5 w-32" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                            <Skeleton className="h-7 w-24 mx-auto mb-1" />
                            <Skeleton className="h-5 w-20 mx-auto" />
                        </div>
                        <div>
                            <Skeleton className="h-7 w-24 mx-auto mb-1" />
                            <Skeleton className="h-5 w-16 mx-auto" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-8 w-52" /></CardHeader>
                <CardContent><Skeleton className="h-20 w-full" /></CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-8 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
        </div>
    )
  }
  
  if (!user || !userData || !levelInfo) {
      return <div>사용자 정보를 불러올 수 없습니다.</div>
  }

  return (
    <div className="container mx-auto flex flex-col gap-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative h-20 w-20 flex items-center justify-center rounded-full bg-secondary flex-shrink-0">
                <span className="text-5xl">{levelInfo.icon}</span>
            </div>
            <div>
              <CardTitle className="font-headline text-3xl">{userData.displayName}</CardTitle>
              <CardDescription>{levelInfo.title}</CardDescription>
              {schoolInfo && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                    <School className="w-4 h-4"/>
                    <span>{schoolInfo}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm font-medium">Lv. {levelInfo.level}</span>
              <span className="text-sm text-muted-foreground">
                {nextLevelInfo ? `${userData.xp.toLocaleString()} / ${nextLevelInfo.xpThreshold.toLocaleString()} XP` : '최고 레벨'}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
             {nextLevelInfo && (
                <p className="text-xs text-right text-muted-foreground mt-1">
                    다음 레벨까지 {nextLevelInfo.xpThreshold - userData.xp} XP 남음
                </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{userData.xp.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">누적 포인트</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{correctRate}%</p>
              <p className="text-sm text-muted-foreground">정답률</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Activity className="text-primary"/> 학습 성취도 분석
          </CardTitle>
          <CardDescription>Gemini AI가 나의 학습 기록을 바탕으로 강점과 약점을 분석해줍니다.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="p-4 rounded-lg bg-secondary/50">
             <h3 className="font-semibold text-lg flex items-center gap-2 text-green-600 dark:text-green-500">
                <BrainCircuit /> 우수한 영역
             </h3>
             {isAnalysisLoading ? <Skeleton className="h-16 mt-2 w-full"/> : (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{analysis?.strongAreas || "아직 분석할 데이터가 충분하지 않아요."}</p>
             )}
          </div>
          <div className="p-4 rounded-lg bg-secondary/50">
             <h3 className="font-semibold text-lg flex items-center gap-2 text-orange-600 dark:text-orange-500">
                <FileWarning /> 부족한 영역
             </h3>
             {isAnalysisLoading ? <Skeleton className="h-16 mt-2 w-full"/> : (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{analysis?.weakAreas || "아직 분석할 데이터가 충분하지 않아요."}</p>
             )}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Sparkles className="text-primary"/> AI 오답 노트
            </CardTitle>
          <CardDescription>틀렸던 문제들을 AI가 새롭게 변형해 출제합니다. 맞춰서 약점을 극복해보세요!</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-6">
                {reviewQuestions.length === 0 && !isLoading && (
                    <p className="text-center text-muted-foreground py-8">틀린 문제가 없습니다! 완벽해요!</p>
                )}
                {reviewQuestions.map((item, index) => (
                    <div key={item.id}>
                        <div className="space-y-3">
                           <div>
                                <p className="font-semibold text-base flex items-center gap-2">
                                  <Lightbulb className="w-5 h-5 text-yellow-400"/> 
                                  문제 {index + 1}
                                </p>
                                {item.isGenerating ? (
                                    <Skeleton className="h-6 w-full mt-1"/>
                                ) : (
                                    <p className="mt-1 text-muted-foreground">{item.newQuestion}</p>
                                )}
                           </div>
                           <div className="flex gap-2">
                               <Input 
                                 placeholder="정답을 서술형으로 입력해보세요."
                                 value={item.userReviewAnswer || ''}
                                 onChange={(e) => handleReviewAnswerChange(item.id, e.target.value)}
                                 disabled={item.isChecking}
                               />
                               <Button onClick={() => handleCheckAnswer(item.id)} disabled={item.isChecking || item.isGenerating}>
                                   {item.isChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : <CheckCircle className="w-4 h-4 mr-2"/>}
                                   {item.isChecking ? '' : '정답 확인'}
                                </Button>
                           </div>
                        </div>
                        {index < reviewQuestions.length -1 && <Separator className="mt-6" />}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <Trophy className="text-primary" /> 레벨 엠블럼 컬렉션
            </CardTitle>
            <CardDescription>지금까지 획득한 엠블럼들을 확인해보세요!</CardDescription>
        </CardHeader>
        <CardContent>
            <TooltipProvider>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-4">
                    {levelSystem.filter(level => userData.xp >= level.xpThreshold).map((level) => (
                        <Tooltip key={level.level}>
                            <TooltipTrigger asChild>
                                <div className={cn(
                                    "group relative aspect-square flex items-center justify-center p-1 rounded-full transition-all duration-300",
                                    'bg-secondary/70'
                                )}>
                                    <span className={cn(
                                        "text-4xl transition-all duration-300 group-hover:scale-110"
                                    )}>
                                        {level.icon}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-semibold">Lv. {level.level}: {level.title}</p>
                                <p className="text-sm text-muted-foreground">필요 XP: {level.xpThreshold.toLocaleString()}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </TooltipProvider>
        </CardContent>
      </Card>

    </div>
  );
}
