
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamBattleGameRoom, Question, TeamBattlePlayer } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Loader2, Crown, Shield, Send, CheckCircle, XCircle } from 'lucide-react';
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
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === question.answer?.trim().toLowerCase();
    }
    return userAnswer === question.correctAnswer;
};

const PlayerStatus = ({ player, result }: { player: TeamBattlePlayer, result?: { isCorrect: boolean, points: number }}) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-background">
        <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
                <PixelAvatar pixels={player.pixelAvatar ? JSON.parse(player.pixelAvatar) : null} />
                <AvatarFallback>{player.nickname.substring(0,1)}</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate">{player.nickname}</span>
        </div>
        {result && (
            <div className="flex items-center gap-1 text-sm">
                {result.isCorrect ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <XCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={cn("font-semibold", result.isCorrect ? "text-green-600" : "text-red-600")}>
                    {result.isCorrect ? `+${result.points}` : ''}
                </span>
            </div>
        )}
    </div>
);

export default function TeamBattleGamePage() {
  const { id: gameRoomId } = useParams();
  const router = useRouter();
  const [user, loadingUser] = useAuthState(auth);
  const [gameRoom, setGameRoom] = useState<TeamBattleGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [userAnswer, setUserAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  
  const isHost = user?.uid === gameRoom?.hostId;
  const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;
  const currentQuestion = gameRoom && gameRoom.currentQuestionIndex >= 0 ? gameRoom.allQuestions[gameRoom.currentQuestionIndex] : null;
  const hasAnswered = user && gameRoom?.currentAnswers && gameRoom.currentAnswers[user.uid];

  // Firestore listener
  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string' || !user) {
        setIsLoading(false);
        return;
    };
    
    const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as TeamBattleGameRoom;

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
        const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
        await updateDoc(roomRef, {
            [`currentAnswers.${user.uid}`]: {
                answer: userAnswer,
                submittedAt: serverTimestamp(),
            }
        });
        toast({title: '답변 제출 완료', description: '다른 플레이어들을 기다려주세요.'});
    } catch (error) {
        toast({variant: 'destructive', title: '오류', description: '답변 제출에 실패했습니다.'});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleShowResults = async () => {
    if (!isHost || !gameRoom || !currentQuestion) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
        const roomDoc = await transaction.get(roomRef);
        if (!roomDoc.exists()) throw "Game room not found";

        const currentRoom = roomDoc.data() as TeamBattleGameRoom;
        const players = { ...currentRoom.players };
        const teams = { ...currentRoom.teams };
        const currentAnswers = currentRoom.currentAnswers || {};
        const newResults: Record<string, {isCorrect: boolean, points: number}> = {};

        const teamAPlayerCount = Object.values(players).filter(p => p.teamId === 'teamA').length;
        const teamBPlayerCount = Object.values(players).filter(p => p.teamId === 'teamB').length;

        for (const uid in players) {
          if (players[uid].isHost) continue;

          const player = players[uid];
          const submission = currentAnswers[uid];
          const isCorrect = submission ? checkAnswer(currentQuestion, submission.answer) : false;
          let points = 0;
          
          if (isCorrect) {
              const basePoints = currentQuestion.points > 0 ? currentQuestion.points : 30;
              let pointMultiplier = 1;

              if (player.teamId === 'teamA' && teamAPlayerCount > 0 && teamAPlayerCount < teamBPlayerCount) {
                  pointMultiplier = teamBPlayerCount / teamAPlayerCount;
              } else if (player.teamId === 'teamB' && teamBPlayerCount > 0 && teamBPlayerCount < teamAPlayerCount) {
                  pointMultiplier = teamAPlayerCount / teamBPlayerCount;
              }
              points = Math.round(basePoints * pointMultiplier);
          }
          
          newResults[uid] = { isCorrect, points };

          if (player.teamId === 'teamA') {
              teams.teamA.score += points;
          } else if (player.teamId === 'teamB') {
              teams.teamB.score += points;
          }
        }
        
        transaction.update(roomRef, {
          teams: teams,
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

    const nextIndex = gameRoom.currentQuestionIndex + 1;
    if (nextIndex >= gameRoom.allQuestions.length) {
        await updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), { status: 'finished' });
    } else {
        await updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), {
            currentQuestionIndex: nextIndex,
            isAnswerRevealed: false,
            currentAnswers: {},
            lastQuestionResults: {},
            currentQuestionStartedAt: serverTimestamp(),
        });
    }
  };
  
  const handleEndGame = async () => {
    await updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), { status: 'finished' });
    setShowEndGameConfirm(false);
  }

  if (isLoading || loadingUser) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
  }
  
  if (!gameRoom || !user) {
      return <div className="text-center p-8">게임을 찾을 수 없거나 참여자가 아닙니다.</div>
  }
  
  if (gameRoom.status === 'finished') {
    const winnerTeam = gameRoom.teams.teamA.score > gameRoom.teams.teamB.score ? gameRoom.teams.teamA : (gameRoom.teams.teamB.score > gameRoom.teams.teamA.score ? gameRoom.teams.teamB : null);
    return (
        <div className="container mx-auto py-8 text-center">
            <Card className="max-w-md mx-auto">
                <CardHeader>
                    <Crown className="w-20 h-20 text-yellow-400 mx-auto" />
                    <CardTitle className="font-headline text-3xl">게임 종료!</CardTitle>
                    {winnerTeam ? (
                        <CardDescription className="text-xl font-bold" style={{color: winnerTeam.id === 'teamA' ? 'red' : 'blue'}}>
                            {winnerTeam.name} 승리!
                        </CardDescription>
                    ) : (
                        <CardDescription className="text-xl font-bold">무승부!</CardDescription>
                    )}
                </CardHeader>
                <CardContent className="space-y-2">
                    <div className="flex justify-between p-3 rounded-lg bg-red-100/50 dark:bg-red-900/50">
                        <span className="font-bold text-red-600">레드 팀</span>
                        <span className="font-bold">{gameRoom.teams.teamA.score}점</span>
                    </div>
                     <div className="flex justify-between p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/50">
                        <span className="font-bold text-blue-600">블루 팀</span>
                        <span className="font-bold">{gameRoom.teams.teamB.score}점</span>
                    </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => router.push('/dashboard')}>대시보드로 돌아가기</Button>
                </CardFooter>
            </Card>
        </div>
    )
  }

  const { teamAPlayers, teamBPlayers } = useMemo(() => {
    if (!gameRoom) return { teamAPlayers: [], teamBPlayers: [] };
    const players = Object.values(gameRoom.players).filter(p => !p.isHost);
    return {
        teamAPlayers: players.filter(p => p.teamId === 'teamA'),
        teamBPlayers: players.filter(p => p.teamId === 'teamB'),
    };
  }, [gameRoom]);

  const answeredCount = gameRoom.currentAnswers ? Object.keys(gameRoom.currentAnswers).length : 0;
  const totalPlayers = teamAPlayers.length + teamBPlayers.length;

  return (
    <div className="container mx-auto py-8 flex flex-col lg:flex-row gap-6">
      <div className="flex-grow space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex justify-between items-center">
                <span>{gameRoom.roomTitle}</span>
                <span className="text-lg font-normal">문제 {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentQuestion ? (
                <div className="space-y-6">
                    {gameRoom.isAnswerRevealed ? (
                         <div className="text-center p-4 rounded-lg bg-secondary space-y-2">
                           <h3 className="font-bold text-xl">정답: {currentQuestion.answer || currentQuestion.correctAnswer}</h3>
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
                        <Button onClick={handleNextQuestion}>다음 문제</Button>
                    ) : (
                        <Button onClick={handleShowResults}>결과 보기</Button>
                    )}
                    <Button variant="destructive" onClick={() => setShowEndGameConfirm(true)}>게임 종료</Button>
                </CardContent>
            </Card>
        )}
      </div>

      <aside className="w-full lg:w-96 flex flex-col gap-4">
        <Card className="bg-red-100/30 dark:bg-red-900/30 border-red-500">
            <CardHeader className="p-4">
                <CardTitle className="text-red-600 dark:text-red-400">레드 팀</CardTitle>
                <CardDescription className="text-lg font-bold">{gameRoom.teams.teamA.score.toLocaleString()}점</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 h-48 overflow-y-auto">
                {teamAPlayers.map(p => <PlayerStatus key={p.uid} player={p} result={gameRoom.lastQuestionResults?.[p.uid]}/>)}
            </CardContent>
        </Card>
        <Card className="bg-blue-100/30 dark:bg-blue-900/30 border-blue-500">
            <CardHeader className="p-4">
                <CardTitle className="text-blue-600 dark:text-blue-400">블루 팀</CardTitle>
                 <CardDescription className="text-lg font-bold">{gameRoom.teams.teamB.score.toLocaleString()}점</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2 h-48 overflow-y-auto">
                {teamBPlayers.map(p => <PlayerStatus key={p.uid} player={p} result={gameRoom.lastQuestionResults?.[p.uid]}/>)}
            </CardContent>
        </Card>
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
