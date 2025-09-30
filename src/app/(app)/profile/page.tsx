'use client';

import { Avatar } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import type { User, AnswerLog, IncorrectAnswer, Question } from '@/lib/types';
import { doc, getDoc, collection, getDocs, updateDoc, increment, deleteDoc, query, orderBy, where, limit } from 'firebase/firestore';
import { Loader2, FileWarning, School, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { getLevelInfo, getNextLevelInfo, LevelInfo, levelSystem } from '@/lib/level-system';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import Image from 'next/image';

const todo_items = [
  { label: '숙제 마무리하기', description: '오늘 배운 내용을 정리하고 숙제를 완성해요', reward: 50 },
  { label: '복습 퀴즈 풀기', description: '틀렸던 문제를 다시 풀어보고 점수를 올려요', reward: 30 },
  { label: '친구와 토론하기', description: '친구와 함께 문제를 토론하며 이해도를 높여요', reward: 20 },
];

function updateTodoItem(index: number, completed: boolean) {
  console.log(`Todo item ${index} completed:`, completed);
}

interface ReviewQuestion extends IncorrectAnswer {
    userReviewAnswer?: string;
    isSubmitting?: boolean;
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

      const answerLogsQuery = query(
          collection(db, 'answerLogs'), 
          where('userId', '==', user.uid),
          orderBy('timestamp', 'desc'), 
          limit(100)
      );
      const incorrectAnswersRef = collection(db, 'users', user.uid, 'incorrect-answers');
      
      const [logsSnapshot, incorrectSnapshot] = await Promise.all([
        getDocs(answerLogsQuery),
        getDocs(query(incorrectAnswersRef, orderBy('timestamp', 'desc')))
      ]).catch(err => {
        console.error("Error fetching profile data:", err);
        toast({ variant: 'destructive', title: '데이터 조회 오류', description: '프로필 데이터를 불러오는 중 오류가 발생했습니다. 보안 규칙을 확인해주세요.'});
        return [null, null];
      });

      if(logsSnapshot) {
        const logsData = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AnswerLog));
        setAnswerLogs(logsData);
      }
      
      if(incorrectSnapshot) {
        const incorrectData = incorrectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncorrectAnswer));
        setReviewQuestions(incorrectData);
      }
      
      setIsLoading(false);
    };

    fetchData();
  }, [user, toast]);

  const handleReviewAnswerChange = (index: number, value: string) => {
    const updatedQuestions = [...reviewQuestions];
    updatedQuestions[index].userReviewAnswer = value;
    setReviewQuestions(updatedQuestions);
  };

  const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === question.answer?.trim().toLowerCase();
    }
    return userAnswer === question.correctAnswer;
  };

  const handleSubmitReview = async (index: number) => {
    const updatedQuestions = [...reviewQuestions];
    const reviewItem = updatedQuestions[index];

    if (!reviewItem.userReviewAnswer) {
      toast({ variant: 'destructive', title: '오류', description: '답변을 입력하거나 선택해주세요.' });
      return;
    }

    updatedQuestions[index].isSubmitting = true;
    setReviewQuestions(updatedQuestions);

    const isCorrect = checkAnswer(reviewItem.question, reviewItem.userReviewAnswer);
    
    try {
        if (user) {
            // Delete the question from incorrect-answers regardless of the outcome
            await deleteDoc(doc(db, 'users', user.uid, 'incorrect-answers', reviewItem.id));

            if (isCorrect) {
                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { xp: increment(10) });
                
                // Update user data locally to reflect XP change
                const newXp = (userData?.xp || 0) + 10;
                setUserData(prev => {
                    if (!prev) return null;
                    const newLevelInfo = getLevelInfo(newXp);
                    if (newLevelInfo.level !== levelInfo?.level) {
                        setLevelInfo(newLevelInfo);
                        setNextLevelInfo(getNextLevelInfo(newLevelInfo.level));
                    }
                    return { ...prev, xp: newXp };
                });

                toast({ title: '정답입니다!', description: '복습을 완료했습니다. 10 XP를 획득했습니다!' });
            } else {
                 toast({ variant: 'destructive', title: '아쉽지만 오답입니다.', description: `정답은 "${reviewItem.question.answer || reviewItem.question.correctAnswer}" 입니다.` });
            }
        }
        
        // Remove the question from the list in the UI
        setReviewQuestions(prev => prev.filter((_, i) => i !== index));

    } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: `답변 제출 중 오류가 발생했습니다: ${error.message}` });
        // If submission fails, revert the submitting state
        const revertedQuestions = [...reviewQuestions];
        if (revertedQuestions[index]) {
            revertedQuestions[index].isSubmitting = false;
        }
        setReviewQuestions(revertedQuestions);
    }
  };


  const actualAnswerLogs = answerLogs.filter(log => log.question && ['subjective', 'multipleChoice', 'ox'].includes(log.question.type));
  const totalQuestions = actualAnswerLogs.length;
  const correctCount = actualAnswerLogs.filter(log => log.isCorrect).length;
  const correctRate = totalQuestions > 0 ? ((correctCount / totalQuestions) * 100).toFixed(1) : '0.0';
  
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
            <Progress value={Math.max(0, progressPercentage)} className="h-3" />
             {nextLevelInfo && (
                <p className="text-xs text-right text-muted-foreground mt-1">
                    다음 레벨까지 {Math.max(0, nextLevelInfo.xpThreshold - userData.xp)} XP 남음
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
                  <FileWarning className="text-primary"/> 오답노트
              </CardTitle>
              <CardDescription>틀렸던 문제들을 다시 풀어보고 점수를 만회하세요!</CardDescription>
          </CardHeader>
          <CardContent>
              {reviewQuestions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                      <p className="text-muted-foreground">복습할 문제가 없습니다. 완벽해요!</p>
                  </div>
              ) : (
                  <div className="space-y-4">
                      {reviewQuestions.map((item, index) => {
                        const question = item.question;
                        return (
                          <div key={item.id} className="p-4 border rounded-lg bg-background shadow-sm space-y-3">
                              <p className="font-semibold text-base">{question.question}</p>
                              
                              {question.imageUrl && (
                                <div className="mt-2 relative aspect-video">
                                    <Image src={encodeURI(question.imageUrl)} alt={`Question ${index + 1} image`} fill className="rounded-md object-contain" unoptimized={true} />
                                </div>
                              )}

                              {question.type === 'subjective' && (
                                <Input 
                                    placeholder="정답을 입력하세요"
                                    value={item.userReviewAnswer || ''}
                                    onChange={(e) => handleReviewAnswerChange(index, e.target.value)}
                                    disabled={item.isSubmitting}
                                />
                              )}
                              {question.type === 'multipleChoice' && question.options && (
                                <RadioGroup 
                                    value={item.userReviewAnswer} 
                                    onValueChange={(value) => handleReviewAnswerChange(index, value)} 
                                    className="space-y-2" 
                                    disabled={item.isSubmitting}
                                >
                                    {question.options.map((option, idx) => (
                                        <div key={idx} className="flex items-center space-x-2">
                                            <RadioGroupItem value={option} id={`review-${item.id}-option-${idx}`} />
                                            <Label htmlFor={`review-${item.id}-option-${idx}`} className="flex-1 p-3 rounded-md border hover:border-primary cursor-pointer">{option}</Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                              )}
                              {question.type === 'ox' && (
                                <RadioGroup 
                                    value={item.userReviewAnswer} 
                                    onValueChange={(value) => handleReviewAnswerChange(index, value)} 
                                    className="grid grid-cols-2 gap-4" 
                                    disabled={item.isSubmitting}
                                >
                                    <Label htmlFor={`review-${item.id}-o`} className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", item.userReviewAnswer === 'O' && 'border-primary bg-primary/10')}>
                                        <RadioGroupItem value="O" id={`review-${item.id}-o`} className="sr-only"/>O
                                    </Label>
                                    <Label htmlFor={`review-${item.id}-x`} className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", item.userReviewAnswer === 'X' && 'border-primary bg-primary/10')}>
                                        <RadioGroupItem value="X" id={`review-${item.id}-x`} className="sr-only"/>X
                                    </Label>
                                </RadioGroup>
                              )}
                              
                              <Button onClick={() => handleSubmitReview(index)} disabled={item.isSubmitting || !item.userReviewAnswer} className="w-full">
                                  {item.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "제출"}
                              </Button>
                          </div>
                        )
                      })}
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
