
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { SurvivalGameRoom, Question, SurvivalPlayer } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Loader2, Crown, Shield, Skull, Swords, Send, CheckCircle, XCircle, HeartPulse } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';

const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === (question.answer || '').trim().toLowerCase();
    }
    return userAnswer.trim() === (question.correctAnswer || '').trim();
};

const PlayerStatus = ({ player, result, rank }: { player: SurvivalPlayer, result?: { isCorrect: boolean, points: number }, rank: number }) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-secondary">
        <div className="flex items-center gap-2">
            <span className="text-sm font-semibold w-6 text-center text-muted-foreground">{rank}.</span>
            <span className="text-sm font-medium">{player.nickname}</span>
        </div>
        {result ? (
            <div className="flex items-center gap-1 text-sm">
                {result.isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={cn("font-semibold w-10 text-right", result.isCorrect ? "text-green-600" : "text-red-600")}>
                    {result.isCorrect ? `+${result.points}` : ''}
                </span>
            </div>
        ) : (
          <span className="text-sm font-bold text-primary w-14 text-right">{player.score}점</span>
        )}
    </div>
);


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
      if (gameRoom?.isAnswerRevealed) setTimeProgress(0);
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
      }
    }, 100);

    return () => clearInterval(interval);
  }, [gameRoom]);
  
  // Firestore listener
  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string' || !user) {
        setIsLoading(false);
        return;
    };
    
    const roomRef = doc(db, 'survival-game-rooms', gameRoomId as string);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as SurvivalGameRoom;

        setGameRoom((prevRoom) => {
            if (prevRoom && user && prevRoom.players[user.uid] && !roomData.players[user.uid]) {
                toast({ variant: "destructive", title: "방에서 내보내졌습니다." });
                router.push('/dashboard');
                return prevRoom;
            }

            if (prevRoom && roomData.currentQuestionIndex !== prevRoom.currentQuestionIndex) {
                setUserAnswer('');
                setIsSubmitting(false);
            }
            
            return roomData;
        });

      } else {
        toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
        router.push('/dashboard');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [gameRoomId, user, router, toast]);

  const handleSubmitAnswer = async () => {
    if (!user || !currentQuestion || !userAnswer || hasAnswered || isHost) return;
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
        const players = { ...currentRoom.players }; // Create a mutable copy
        const currentAnswers = currentRoom.currentAnswers || {};
        const newResults: Record<string, {isCorrect: boolean, points: number}> = {};
        const startTime = (currentRoom.currentQuestionStartedAt as any)?.toDate()?.getTime();
        const timeLimit = currentRoom.timeLimitPerQuestion * 1000;
        
        const playerUIDs = Object.keys(players).filter(uid => uid !== currentRoom.hostId);

        for (const uid of playerUIDs) {
          const player = players[uid];

          const submission = currentAnswers[uid];
          const isCorrect = submission ? checkAnswer(currentQuestion, submission.answer) : false;
          
          let points = 0;
          if (isCorrect) {
              const basePoints = currentQuestion.points > 0 ? currentQuestion.points : 30;
              let timeBonus = 0;
              if (startTime && submission?.submittedAt) {
                  const submissionTime = (submission.submittedAt as any).toDate().getTime();
                  const timeTaken = submissionTime - startTime;
                  if (timeTaken > 0 && timeLimit > 0) {
                    timeBonus = Math.max(0, Math.floor((1 - (timeTaken / timeLimit)) * (basePoints / 2)));
                  }
              }
              points = (basePoints || 30) + (timeBonus || 0);
          }
          
          if(isNaN(points)) {
            points = 0;
          }

          newResults[uid] = { isCorrect, points };

          players[uid].score = (players[uid].score || 0) + points;
          
          if (!player.isEliminated && !isCorrect) {
              players[uid].isEliminated = true;
          }
          
          players[uid].answers.push({
              questionId: currentQuestion.id,
              isCorrect,
              points,
              submittedAt: submission?.submittedAt || Timestamp.now(),
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

    const currentSurvivors = Object.values(gameRoom.players).filter(p => !p.isHost && !p.isEliminated);
    if (currentSurvivors.length <= 1) {
        await updateDoc(doc(db, 'survival-game-rooms', gameRoomId as string), { status: 'finished' });
        return;
    }
    
    const nextIndex = gameRoom.currentQuestionIndex + 1;
    if (nextIndex >= gameRoom.allQuestions.length) {
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
  
  const handleRevival = async () => {
    if (!isHost || !gameRoom || !gameRoom.revivalEnabled || gameRoom.revivalHappened) {
      toast({
        variant: 'destructive',
        title: '패자부활 불가',
        description: '패자부활을 실행할 수 없는 상태입니다.',
      });
      return;
    }

    const eliminatedPlayers = Object.values(gameRoom.players).filter(p => !p.isHost && p.isEliminated);

    if (eliminatedPlayers.length === 0) {
      toast({
        title: '패자부활',
        description: '탈락한 학생이 없어 패자부활을 진행하지 않습니다.',
      });
      return;
    }

    eliminatedPlayers.sort((a, b) => b.score - a.score);

    const revivalCount = Math.ceil(eliminatedPlayers.length * (gameRoom.revivalPercentage / 100));
    const playersToRevive = eliminatedPlayers.slice(0, revivalCount);

    if (playersToRevive.length === 0) {
        toast({
            title: '패자부활',
            description: '부활할 학생이 없습니다.',
        });
        return;
    }

    try {
      const roomRef = doc(db, 'survival-game-rooms', gameRoomId as string);
      const updates: Record<string, any> = {
        revivalHappened: true,
      };
      const revivedPlayerNames: string[] = [];

      playersToRevive.forEach(player => {
        updates[`players.${player.uid}.isEliminated`] = false;
        revivedPlayerNames.push(player.nickname);
      });

      await updateDoc(roomRef, updates);

      toast({
        title: '패자부활 성공!',
        description: `${revivedPlayerNames.join(', ')} 학생이 부활했습니다.`,
      });

    } catch (error) {
      console.error("Error during revival:", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '패자부활 처리 중 오류가 발생했습니다.',
      });
    }
  };


  const handleEndGame = async () => {
    await updateDoc(doc(db, 'survival-game-rooms', gameRoomId as string), { status: 'finished' });
    setShowEndGameConfirm(false);
  }

  const { players, lastQuestionResults, hostId } = gameRoom || {};
  const allPlayingPlayers = useMemo(() => 
    players ? Object.values(players).filter(p => p.uid !== hostId).sort((a, b) => b.score - a.score) : [],
    [players, hostId]
  );

  const survivors = useMemo(() => allPlayingPlayers.filter(p => !p.isEliminated), [allPlayingPlayers]);
  const eliminated = useMemo(() => allPlayingPlayers.filter(p => p.isEliminated), [allPlayingPlayers]);


  const renderPlayerList = (title: string, players: SurvivalPlayer[], icon: React.ReactNode) => (
    <Card>
        <CardHeader className="p-4">
            <CardTitle className="text-lg flex items-center gap-2">{icon} {title} ({players.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <div className="flex flex-wrap gap-2">
                {players.map(p => (
                    <div key={p.uid} className="flex items-center gap-2 px-3 py-1 rounded-full bg-secondary">
                        <span className="text-sm font-medium">{p.nickname}</span>
                    </div>
                ))}
            </div>
        </CardContent>
    </Card>
  );
  
  const renderEliminatedPlayerList = (title: string, players: SurvivalPlayer[], icon: React.ReactNode) => (
    <Card>
        <CardHeader className="p-4">
            <CardTitle className="text-lg flex items-center gap-2">{icon} {title} ({players.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
            <ScrollArea className="h-40">
                <div className="space-y-2 pr-4">
                    {players.map((p, index) => (
                        <PlayerStatus key={p.uid} player={p} rank={index + 1} />
                    ))}
                </div>
            </ScrollArea>
        </CardContent>
    </Card>
  );

  if (isLoading || loadingUser) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }
  
  if (!gameRoom || !user) {
      return <div className="text-center p-8">게임을 찾을 수 없거나 참여자가 아닙니다.</div>
  }

  const answeredCount = gameRoom.currentAnswers ? Object.keys(gameRoom.currentAnswers).length : 0;
  const totalPlayers = allPlayingPlayers.length;

  if (gameRoom.status === 'finished') {
    const finalPlayers = Object.values(gameRoom.players).filter(p => !p.isHost).sort((a,b)=> b.score - a.score);
    return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <Image src="https://i.postimg.cc/m2PL9n9h/choejong-gyeolgwa.png" alt="게임 종료" width={150} height={150} className="mx-auto" />
                    <CardTitle className="font-headline text-3xl">게임 종료!</CardTitle>
                    {survivors.length === 1 && <CardDescription>최후의 생존자: {survivors[0].nickname}</CardDescription>}
                    {survivors.length === 0 && <CardDescription>최후의 생존자가 없습니다.</CardDescription>}
                    {survivors.length > 1 && <CardDescription>동점자가 발생했습니다!</CardDescription>}
                </CardHeader>
                <CardContent>
                    <h3 className="font-semibold mb-2">최종 순위</h3>
                    <ScrollArea className="h-60">
                        <div className="space-y-2 pr-4">
                            {finalPlayers.map((p, i) => (
                                <div key={p.uid} className="flex justify-between items-center p-2 rounded-md bg-secondary">
                                    <span className="font-medium">{i+1}. {p.nickname}</span>
                                    <span className="font-bold text-primary">{p.score}점</span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => router.push('/dashboard')}>대시보드로 돌아가기</Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  const correctPlayers = survivors.filter(p => lastQuestionResults?.[p.uid]?.isCorrect);
  const incorrectPlayers = allPlayingPlayers.filter(p => lastQuestionResults && lastQuestionResults[p.uid] && !lastQuestionResults[p.uid].isCorrect);
  const noAnswerPlayers = allPlayingPlayers.filter(p => !lastQuestionResults?.[p.uid]);


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
                        <div className="space-y-4">
                           <div className="text-center p-4 rounded-lg bg-secondary space-y-2">
                                <h3 className="font-bold text-xl">정답: {currentQuestion.answer || currentQuestion.correctAnswer}</h3>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader className="p-3"><CardTitle className="text-base text-green-600">정답자 ({correctPlayers.length})</CardTitle></CardHeader>
                                    <CardContent className="p-3 pt-0 h-40 overflow-y-auto space-y-2">
                                        {correctPlayers.map((p, i) => <PlayerStatus key={p.uid} player={p} result={lastQuestionResults?.[p.uid]} rank={i+1}/>)}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="p-3"><CardTitle className="text-base text-red-600">오답자 ({incorrectPlayers.length})</CardTitle></CardHeader>
                                    <CardContent className="p-3 pt-0 h-40 overflow-y-auto space-y-2">
                                        {incorrectPlayers.map((p, i) => <PlayerStatus key={p.uid} player={p} result={lastQuestionResults?.[p.uid]} rank={i+1}/>)}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader className="p-3"><CardTitle className="text-base text-muted-foreground">미제출 ({noAnswerPlayers.length})</CardTitle></CardHeader>
                                    <CardContent className="p-3 pt-0 h-40 overflow-y-auto space-y-2">
                                        {noAnswerPlayers.map((p, i) => <PlayerStatus key={p.uid} player={p} rank={i+1}/>)}
                                    </CardContent>
                                </Card>
                           </div>
                        </div>
                    ) : (
                    <>
                        {currentQuestion.imageUrl && (
                            <div className="relative aspect-video w-full">
                                <Image src={currentQuestion.imageUrl} alt="질문 이미지" fill className="rounded-md object-contain" />
                            </div>
                        )}
                        <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                        
                        {currentPlayer && !isHost && (
                            <div className="space-y-4 pt-4 border-t">
                                {currentPlayer.isEliminated && !hasAnswered && (
                                    <p className="text-center font-semibold text-orange-500">현재 탈락 상태입니다. 패자부활을 위해 계속 문제를 풀어보세요!</p>
                                )}
                                {hasAnswered ? (
                                    <p className="text-center text-primary font-semibold">답변을 제출했습니다. 결과를 기다려주세요.</p>
                                ) : (
                                <>
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
                                </>
                                )}
                            </div>
                        )}
                        {isHost && !gameRoom.isAnswerRevealed && (
                            <p className="text-center text-muted-foreground font-semibold">
                                호스트는 문제를 풀지 않습니다. 학생들이 문제를 풀고 있습니다.
                            </p>
                        )}
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
                <CardHeader>
                  <CardTitle>호스트 컨트롤</CardTitle>
                  {!gameRoom.isAnswerRevealed && (
                    <CardDescription>
                      답변 제출 현황: {answeredCount} / {totalPlayers}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex gap-2">
                    {gameRoom.isAnswerRevealed ? (
                       <>
                        <Button onClick={handleNextQuestion}>다음 문제</Button>
                        {gameRoom.revivalEnabled && !gameRoom.revivalHappened && eliminated.length > 0 && (
                            <Button onClick={handleRevival} variant="outline">
                                <HeartPulse className="w-4 h-4 mr-2" />
                                패자부활
                            </Button>
                        )}
                       </>
                    ) : (
                        <Button onClick={handleShowResults} disabled={timeRemaining > 0 && totalPlayers > answeredCount}>결과 보기</Button>
                    )}
                    <Button variant="destructive" onClick={() => setShowEndGameConfirm(true)}>게임 종료</Button>
                </CardContent>
            </Card>
        )}
      </div>

      <aside className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">
        {renderPlayerList('생존자', survivors, <Shield className="text-green-500"/>)}
        {renderEliminatedPlayerList('탈락자', eliminated, <Skull className="text-red-500"/>)}
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
