
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
import { useEffect, useState, useMemo } from 'react';
import type { User, AnswerLog, IncorrectAnswer, Question } from '@/lib/types';
import { doc, getDoc, collection, getDocs, updateDoc, increment, deleteDoc, Timestamp, query } from 'firebase/firestore';
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
    newQuestion?: string;
    isGenerating?: boolean;
    userReviewAnswer?: string;
    isChecking?: boolean;
    isCorrect?: boolean;
    explanation?: string;
}

async function callApi(action: string, data: any) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
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
  const [answerLogs, setAnswerLogs] = useState<AnswerLog[]>([]);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [nextLevelInfo, setNextLevelInfo] = useState<LevelInfo | null>(null);

  const [learningAnalysis, setLearningAnalysis] = useState<{ strongAreas: string; weakAreas: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setIsLoading(true);
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const fetchedUserData = userSnap.data() as User;
        setUserData(fetchedUserData);
        
        const currentLevel = getLevelInfo(fetchedUserData.xp);
        setLevelInfo(currentLevel);
        setNextLevelInfo(getNextLevelInfo(currentLevel.level));
      }

      const answerLogsRef = collection(db, 'users', user.uid, 'answerLogs');
      const incorrectAnswersRef = collection(db, 'users', user.uid, 'incorrect-answers');
      
      const [logsSnapshot, incorrectSnapshot] = await Promise.all([
        getDocs(query(answerLogsRef)),
        getDocs(query(incorrectAnswersRef))
      ]);

      const logsData = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnswerLog));
      const incorrectData = incorrectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncorrectAnswer));

      setAnswerLogs(logsData);
      setReviewQuestions(incorrectData.map(item => ({...item, isGenerating: false})));
      setIsLoading(false);
    };

    fetchData();
  }, [user]);
  
  const handleAnalyzeLearning = async () => {
      setIsAnalyzing(true);
      try {
          const simplifiedLogs = answerLogs
            .filter(log => log.question && log.question.question) // Ensure log has a question
            .map(log => ({
              question: log.question.question,
              isCorrect: log.isCorrect
            }));

          if (simplifiedLogs.length === 0) {
            toast({ title: '분석 불가', description: '분석할 학습 기록이 없습니다.' });
            setIsAnalyzing(false);
            return;
          }

          const result = await callApi('analyzeLearning', { 
            answerLogs: simplifiedLogs,
          });
          setLearningAnalysis(result);
      } catch (error: any) {
          toast({ variant: 'destructive', title: '분석 오류', description: error.message });
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleGenerateReviewQuestion = async (index: number) => {
    const updatedQuestions = [...reviewQuestions];
    const originalQuestionData = updatedQuestions[index].question;
    
    updatedQuestions[index].isGenerating = true;
    setReviewQuestions(updatedQuestions);

    try {
      // Pass a simplified object to the API
      const result = await callApi('generateReviewQuestion', {
        originalQuestion: {
          question: originalQuestionData.question,
          answer: originalQuestionData.answer,
          correctAnswer: originalQuestionData.correctAnswer,
          grade: originalQuestionData.grade,
          subject: originalQuestionData.subject,
          imageUrl: originalQuestionData.imageUrl,
        }
      });
      updatedQuestions[index].newQuestion = result.newQuestion;
    } catch (error: any) {
      toast({ variant: 'destructive', title: '오류', description: '복습 질문 생성 중 오류가 발생했습니다.' });
    } finally {
      updatedQuestions[index].isGenerating = false;
      setReviewQuestions(updatedQuestions);
    }
  };
  
  const handleCheckReviewAnswer = async (index: number) => {
    const updatedQuestions = [...reviewQuestions];
    if (!updatedQuestions[index].userReviewAnswer) {
      toast({ variant: 'destructive', title: '오류', description: '답변을 입력해주세요.' });
      return;
    }

    updatedQuestions[index].isChecking = true;
    setReviewQuestions(updatedQuestions);

    try {
      const { isCorrect, explanation } = await callApi('checkReviewAnswer', {
        originalQuestion: updatedQuestions[index].question,
        reviewQuestion: updatedQuestions[index].newQuestion!,
        userAnswer: updatedQuestions[index].userReviewAnswer!,
      });
      updatedQuestions[index].isCorrect = isCorrect;
      updatedQuestions[index].explanation = explanation;

      if (isCorrect) {
        toast({ title: '정답입니다!', description: '복습을 완료했습니다. 10 XP를 획득했습니다!' });
        
        if (user) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { xp: increment(10) });
            await deleteDoc(doc(db, 'users', user.uid, 'incorrect-answers', updatedQuestions[index].id));
            if(userData) setUserData({...userData, xp: userData.xp + 10});
        }
        
        setTimeout(() => {
          setReviewQuestions(prev => prev.filter((_, i) => i !== index));
        }, 1500);

      } else {
        toast({ variant: 'destructive', title: '아쉽지만 오답입니다.', description: explanation });
      }

    } catch (error: any) {
      toast({ variant: 'destructive', title: '오류', description: '답변 확인 중 오류가 발생했습니다.' });
    } finally {
      updatedQuestions[index].isChecking = false;
      setReviewQuestions(updatedQuestions);
    }
  };

  const handleReviewAnswerChange = (index: number, value: string) => {
    const updatedQuestions = [...reviewQuestions];
    updatedQuestions[index].userReviewAnswer = value;
    setReviewQuestions(updatedQuestions);
  };


  const { totalQuestions, correctRate } = useMemo(() => {
    const actualAnswerLogs = answerLogs.filter(log => log.question && log.userAnswer !== 'effect');
    const total = actualAnswerLogs.length;
    if (total === 0) {
        return { totalQuestions: 0, correctRate: '0.0' };
    }
    const correctCount = actualAnswerLogs.filter(log => log.isCorrect).length;
    const rate = ((correctCount / total) * 100).toFixed(1);
    return { totalQuestions: total, correctRate: rate };
  }, [answerLogs]);

  
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
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <BrainCircuit className="text-primary"/> 학습 성취도 분석
                    </CardTitle>
                    <CardDescription>AI가 나의 학습 패턴을 분석해 강점과 약점을 알려줘요.</CardDescription>
                </div>
                <Button onClick={handleAnalyzeLearning} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                    분석하기
                </Button>
            </div>
        </CardHeader>
        {learningAnalysis && (
            <CardContent>
                <div className="grid md:grid-cols-2 gap-6 p-4 bg-secondary/30 rounded-lg">
                    <div>
                        <h3 className="font-semibold text-green-600">🚀 강점 분야</h3>
                        <div className="text-sm mt-2 prose prose-sm prose-p:my-1 prose-ul:my-1 text-muted-foreground" dangerouslySetInnerHTML={{ __html: learningAnalysis.strongAreas.replace(/\n/g, '<br/>') }} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-orange-600">🤔 약점 분야</h3>
                        <div className="text-sm mt-2 prose prose-sm prose-p:my-1 prose-ul:my-1 text-muted-foreground" dangerouslySetInnerHTML={{ __html: learningAnalysis.weakAreas.replace(/\n/g, '<br/>') }} />
                    </div>
                </div>
            </CardContent>
        )}
      </Card>
      
      <Card>
          <CardHeader>
              <CardTitle className="font-headline flex items-center gap-2">
                  <FileWarning className="text-primary"/> AI 오답노트
              </CardTitle>
              <CardDescription>틀렸던 문제들을 AI가 만든 새로운 문제로 복습하고 점수를 만회하세요!</CardDescription>
          </CardHeader>
          <CardContent>
              {reviewQuestions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground">복습할 문제가 없습니다. 완벽해요!</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {reviewQuestions.map((item, index) => (
                          <div key={item.id} className="p-4 border rounded-lg bg-background shadow-sm">
                              <p className="text-sm text-muted-foreground">
                                  <strong>원본 문제:</strong> {item.question.question}
                              </p>
                              <Separator className="my-3"/>
                              
                              {!item.newQuestion && (
                                <Button onClick={() => handleGenerateReviewQuestion(index)} disabled={item.isGenerating}>
                                    {item.isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Lightbulb className="w-4 h-4 mr-2"/>}
                                    AI 복습 문제 만들기
                                </Button>
                              )}

                              {item.newQuestion && (
                                  <div className="space-y-3">
                                      <p className="font-semibold">{item.newQuestion}</p>
                                      <div className="flex gap-2">
                                          <Input 
                                              placeholder="정답을 입력하세요"
                                              value={item.userReviewAnswer || ''}
                                              onChange={(e) => handleReviewAnswerChange(index, e.target.value)}
                                              disabled={item.isChecking || item.isCorrect}
                                          />
                                          <Button onClick={() => handleCheckReviewAnswer(index)} disabled={item.isChecking || item.isCorrect}>
                                              {item.isChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : "제출"}
                                          </Button>
                                      </div>
                                      {item.isCorrect === true && (
                                        <p className="text-sm text-green-600 font-semibold flex items-center gap-1"><CheckCircle className="w-4 h-4"/> 정답! {item.explanation}</p>
                                      )}
                                      {item.isCorrect === false && (
                                         <p className="text-sm text-destructive font-semibold">{item.explanation}</p>
                                      )}
                                  </div>
                              )}

                          </div>
                      ))}
                  </div>
              )}
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
            <TooltipProvider delayDuration={0}>
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
