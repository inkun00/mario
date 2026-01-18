'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, writeBatch, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { SurvivalGameRoom, Question } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Loader2, Crown, Shield, Skull, Swords, Send, UserCheck, UserX, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === question.answer?.trim().toLowerCase();
    }
    return userAnswer === question.correctAnswer;
};

export default function SurvivalQuizGamePage() {
  const { id: gameRoomId } = useParams();
  const router = useRouter();
  const [user, loadingUser] = useAuthState(auth);
  const [gameRoom, setGameRoom] = useState<SurvivalGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeProgress, setTimeProgress] = useState(100);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  
  const isHost = user?.uid === gameRoom?.hostId;
  const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;
  const currentQuestion = gameRoom && gameRoom.currentQuestionIndex >= 0 ? gameRoom.allQuestions[gameRoom.currentQuestionIndex] : null;
  const hasAnswered = user && gameRoom?.currentAnswers && gameRoom.currentAnswers[user.uid];

  // Timer logic
  useEffect(() => {
    if (!gameRoom || !gameRoom.currentQuestionEndsAt || gameRoom.isAnswerRevealed) {
      return;
    }
    const interval = setInterval(() => {
      const endsAt = (gameRoom.currentQuestionEndsAt as any).toDate();
      const remaining = Math.max(0, endsAt.getTime() - Date.now());
      setTimeRemaining(remaining);
      const totalTime = gameRoom.timeLimitPerQuestion * 1000;
      setTimeProgress((remaining / totalTime) * 100);

      if (remaining === 0) {
        clearInterval(interval);
        if (isHost) {
          // Time is up, host processes results
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameRoom, isHost]);
  
  // Firestore listener
  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string') return;
    const roomRef = doc(db, 'survival-game-rooms', gameRoomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as SurvivalGameRoom;
        setGameRoom(roomData);

        // Reset user answer for new question
        if (gameRoom && roomData.currentQuestionIndex !== gameRoom.currentQuestionIndex) {
            setUserAnswer('');
            setIsSubmitting(false);
        }

      } else {
        toast({variant: 'destructive', title: '오류', description: '게임을 찾을 수 없습니다.'});
        router.push('/dashboard');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [gameRoomId, router, toast, gameRoom]);

  const handleSubmitAnswer = async () => {
    if (!user || !currentQuestion || !userAnswer || hasAnswered) return;
    setIsSubmitting(true);
    try {
        const roomRef = doc(db, 'survival-game-rooms', gameRoomId as string);
        await updateDoc(roomRef, {
            [`currentAnswers.${user.uid}`]: {
                answer: userAnswer,
                submittedAt: serverTimestamp(),
            }
        });
        toast({title: '답변 제출 완료', description: '다른 플레이어들을 기다려주세요.'});
    } catch (error) {
        toast({variant: 'destructive', title: '오류', description: '답변 제출에 실패했습니다.'});
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleShowResults = async () => {
    if (!isHost || !gameRoom || !currentQuestion) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, 'survival-game-rooms', gameRoomId as string);
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw "Game room not found";

        const currentRoom = roomDoc.data() as SurvivalGameRoom;
        const players = currentRoom.players;
        const currentAnswers = currentRoom.currentAnswers || {};
        const newResults: Record<string, {isCorrect: boolean, points: number}> = {};
        const startTime = (currentRoom.currentQuestionStartedAt as any)?.toDate().getTime();
        const timeLimit = currentRoom.timeLimitPerQuestion * 1000;
        
        for (const uid in players) {
          const player = players[uid];
          if (player.isEliminated) continue;

          const submission = currentAnswers[uid];
          const isCorrect = submission ? checkAnswer(currentQuestion, submission.answer) : false;
          let points = 0;
          
          if (isCorrect) {
              const submissionTime = (submission.submittedAt as any).toDate().getTime();
              const timeTaken = submissionTime - startTime;
              const timeBonus = Math.max(0, Math.floor((1 - (timeTaken / timeLimit)) * (currentQuestion.points / 2)));
              points = (currentQuestion.points || 10) + timeBonus;
          }
          
          newResults[uid] = { isCorrect, points };

          players[uid].score += points;
          if (!isCorrect) {
              players[uid].isEliminated = true;
          }
          players[uid].answers.push({
              questionId: currentQuestion.id,
              isCorrect,
              points,
              submittedAt: submission?.submittedAt || serverTimestamp(),
          });
        }
        
        transaction.update(roomRef, {
          players: players,
          isAnswerRevealed: true,
          lastQuestionResults: newResults,
        });
      });
    } catch (error) {
      console.error("Error showing results:", error);
      toast({variant: 'destructive', title: '오류', description: '결과를 처리하는 중 오류가 발생했습니다.'});
    }
  };

  const handleNextQuestion = async () => {
    if (!isHost || !gameRoom) return;

    // TODO: 패자부활 로직
    const nextIndex = gameRoom.currentQuestionIndex + 1;
    if (nextIndex >= gameRoom.allQuestions.length) {
        // Game over
        await updateDoc(doc(db, 'survival-game-rooms', gameRoomId as string), { status: 'finished' });
    } else {
        await updateDoc(doc(db, 'survival-game-rooms', gameRoomId as string), {
            currentQuestionIndex: nextIndex,
            isAnswerRevealed: false,
            currentAnswers: {},
            lastQuestionResults: {},
            currentQuestionStartedAt: serverTimestamp(),
            currentQuestionEndsAt: new Date(Date.now() + gameRoom.timeLimitPerQuestion * 1000),
        });
    }
  };

  const handleEndGame = async () => {
    await updateDoc(doc(db, 'survival-game-rooms', gameRoomId as string), { status: 'finished' });
    setShowEndGameConfirm(false);
  }

  const renderPlayerList = (title: string, players: any[], icon: React.ReactNode) => (
    <Card>
        <CardHeader className="p-4">
            <CardTitle className="text-lg flex items-center gap-2">{icon} {title} ({players.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {players.map(p => (
                    <div key={p.uid} className="flex items-center gap-2 p-2 rounded-md bg-secondary">
                        <Avatar className="w-6 h-6">
                            <PixelAvatar pixels={p.pixelAvatar ? JSON.parse(p.pixelAvatar) : null} />
                            <AvatarFallback>{p.nickname.substring(0,1)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate">{p.nickname}</span>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
  );

  if (isLoading || loadingUser) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }
  
  if (!gameRoom || !user) {
      return <div className="text-center p-8">게임을 찾을 수 없거나 참여자가 아닙니다.</div>
  }

  const { players } = gameRoom;
  const survivors = Object.values(players).filter(p => !p.isEliminated);
  const eliminated = Object.values(players).filter(p => p.isEliminated);

  if (gameRoom.status === 'finished') {
    return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <Crown className="w-20 h-20 text-yellow-400 mx-auto" />
                    <CardTitle className="font-headline text-3xl">게임 종료!</CardTitle>
                    {survivors.length === 1 && <CardDescription>최후의 생존자: {survivors[0].nickname}</CardDescription>}
                    {survivors.length === 0 && <CardDescription>최후의 생존자가 없습니다.</CardDescription>}
                    {survivors.length > 1 && <CardDescription>동점자가 발생했습니다!</CardDescription>}
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-2">최종 순위</h3>
                    <div className="space-y-2">
                        {Object.values(players).sort((a,b) => b.score - a.score).map((p, i) => (
                             <div key={p.uid} className="flex justify-between items-center p-2 rounded-md bg-secondary">
                                <span className="font-medium">{i+1}. {p.nickname}</span>
                                <span className="font-bold text-primary">{p.score}점</span>
                             </div>
                        ))}
                    </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => router.push('/dashboard')}>대시보드로 돌아가기</Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  return (
    <div className="container mx-auto py-8 flex flex-col lg:flex-row gap-6">
      <div className="flex-grow space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex justify-between items-center">
                <span>{gameRoom.roomTitle}</span>
                <span className="text-lg font-normal">문제 {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</span>
            </CardTitle>
            {currentQuestion && <Progress value={timeProgress} className="mt-2" />}
            {timeRemaining > 0 && !gameRoom.isAnswerRevealed && <p className="text-center text-sm text-muted-foreground mt-1">남은 시간: {Math.ceil(timeRemaining/1000)}초</p>}
          </CardHeader>
          <CardContent>
            {currentQuestion ? (
                <div className="space-y-6">
                    {gameRoom.isAnswerRevealed ? (
                        <div className="text-center p-8 rounded-lg bg-secondary space-y-4">
                            <h3 className="font-bold text-xl">정답: {currentQuestion.answer || currentQuestion.correctAnswer}</h3>
                            {currentPlayer && gameRoom.lastQuestionResults && gameRoom.lastQuestionResults[currentPlayer.uid] && (
                                <div className={cn("text-lg font-semibold", gameRoom.lastQuestionResults[currentPlayer.uid].isCorrect ? "text-green-600" : "text-red-600")}>
                                    {gameRoom.lastQuestionResults[currentPlayer.uid].isCorrect ? `정답! +${gameRoom.lastQuestionResults[currentPlayer.uid].points}점` : '오답...'}
                                </div>
                            )}
                        </div>
                    ) : (
                    <>
                        {currentQuestion.imageUrl && (
                            <div className="relative aspect-video w-full">
                                <Image src={currentQuestion.imageUrl} alt="질문 이미지" fill className="rounded-md object-contain" />
                            </div>
                        )}
                        <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                        
                        {currentPlayer && !currentPlayer.isEliminated && !hasAnswered && (
                            <div className="space-y-4 pt-4 border-t">
                                {currentQuestion.type === 'subjective' && (
                                    <Input placeholder="정답을 입력하세요" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={isSubmitting} />
                                )}
                                {currentQuestion.type === 'multipleChoice' && currentQuestion.options && (
                                    <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-1 sm:grid-cols-2 gap-2" disabled={isSubmitting}>
                                        {currentQuestion.options.map((option, index) => (
                                            <Label key={index} htmlFor={`option-${index}`} className="flex items-center gap-3 p-3 rounded-md border hover:border-primary cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                                <RadioGroupItem value={option} id={`option-${index}`} />
                                                {option}
                                            </Label>
                                        ))}
                                    </RadioGroup>
                                )}
                                {currentQuestion.type === 'ox' && (
                                     <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-2 gap-4" disabled={isSubmitting}>
                                        <Label htmlFor="option-o" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'O' && 'border-primary bg-primary/10')}>
                                            <RadioGroupItem value="O" id="option-o" className="sr-only"/>O
                                        </Label>
                                        <Label htmlFor="option-x" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'X' && 'border-primary bg-primary/10')}>
                                            <RadioGroupItem value="X" id="option-x" className="sr-only"/>X
                                        </Label>
                                    </RadioGroup>
                                )}
                                <Button className="w-full" onClick={handleSubmitAnswer} disabled={isSubmitting || !userAnswer}>
                                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4 mr-2" />}
                                    제출하기
                                </Button>
                            </div>
                        )}
                        {currentPlayer && hasAnswered && <p className="text-center text-primary font-semibold">답변을 제출했습니다. 결과를 기다려주세요.</p>}
                        {currentPlayer && currentPlayer.isEliminated && <p className="text-center text-destructive font-semibold">탈락했습니다. 다른 플레이어들을 응원해주세요.</p>}
                    </>
                    )}
                </div>
            ) : (
                <div className="text-center py-10 text-muted-foreground">호스트가 게임을 시작하기를 기다리고 있습니다...</div>
            )}
          </CardContent>
        </Card>
        
        {isHost && (
             <Card>
                <CardHeader><CardTitle>호스트 컨트롤</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                    {gameRoom.isAnswerRevealed ? (
                        <Button onClick={handleNextQuestion}>다음 문제</Button>
                    ) : (
                        <Button onClick={handleShowResults} disabled={timeRemaining > 0}>결과 보기</Button>
                    )}
                    <Button variant="destructive" onClick={() => setShowEndGameConfirm(true)}>게임 종료</Button>
                </CardContent>
            </Card>
        )}
      </div>

      <aside className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">
        {renderPlayerList('생존자', survivors, <Shield className="text-green-500"/>)}
        {renderPlayerList('탈락자', eliminated, <Skull className="text-red-500"/>)}
      </aside>
      
      <AlertDialog open={showEndGameConfirm} onOpenChange={setShowEndGameConfirm}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>게임을 종료하시겠습니까?</AlertDialogTitle></AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleEndGame} className="bg-destructive hover:bg-destructive/90">종료</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
