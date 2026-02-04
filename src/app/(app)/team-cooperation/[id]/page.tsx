

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, runTransaction, Timestamp, increment, writeBatch, collection } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamCooperationGameRoom, Question, TeamCooperationPlayer, PointLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, Trophy, Send, CheckCircle, XCircle, Copy } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === (question.answer || '').trim().toLowerCase();
    }
    return userAnswer.trim() === (question.correctAnswer || '').trim();
};

export default function TeamCooperationGamePage() {
    const { id: gameRoomId } = useParams();
    const router = useRouter();
    const [user, loadingUser] = useAuthState(auth);
    const [gameRoom, setGameRoom] = useState<TeamCooperationGameRoom | null>(null);
    const { toast } = useToast();

    const [userAnswer, setUserAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [timeProgress, setTimeProgress] = useState(100);

    const isHost = user?.uid === gameRoom?.hostId;
    const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;

    const currentQuestion = useMemo(() => {
        if (!gameRoom || typeof gameRoom.currentQuestionIndex !== 'number' || gameRoom.currentQuestionIndex < 0) return null;
        return gameRoom.allQuestions[gameRoom.currentQuestionIndex] || null;
    }, [gameRoom]);
    
    const hasAnsweredCurrentQuestion = useMemo(() => {
        if (!gameRoom || !user) return false;
        return !!gameRoom.currentAnswers?.[user.uid];
    }, [gameRoom, user]);

    const copyToClipboard = () => {
        if (!gameRoomId || typeof gameRoomId !== 'string') return;
        navigator.clipboard.writeText(gameRoomId).then(() => {
            toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
        });
    };

    // Firestore listener
    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || !user) return;
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const newRoomData = { id: docSnap.id, ...docSnap.data() } as TeamCooperationGameRoom;
                setGameRoom((prevRoom) => {
                    if (prevRoom && newRoomData.currentQuestionIndex !== prevRoom.currentQuestionIndex) {
                        setUserAnswer('');
                        setIsSubmitting(false);
                    }
                    return newRoomData;
                });
            } else {
                toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
                router.push('/dashboard');
            }
        });
        return () => unsubscribe();
    }, [gameRoomId, user, router, toast]);

    // Question Timer
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

    const handleSubmitAnswer = async () => {
        if (!user || !currentPlayer || !currentQuestion || !userAnswer || hasAnsweredCurrentQuestion || isHost) return;
        setIsSubmitting(true);
        try {
            const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
            await updateDoc(roomRef, { [`currentAnswers.${user.uid}`]: { answer: userAnswer, submittedAt: Timestamp.now() } });
            toast({ title: '답변 제출 완료!', description: '다른 플레이어들의 답변을 기다려주세요.' });
        } catch (error) {
            toast({ variant: 'destructive', title: '오류', description: '답변 제출에 실패했습니다.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleTallyAndProceed = async () => {
        if (!isHost || !gameRoom || !currentQuestion) return;
    
        try {
            await runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw "Game room not found";
    
                const currentRoom = roomDoc.data() as TeamCooperationGameRoom;
                const players = { ...currentRoom.players };
                const currentAnswers = currentRoom.currentAnswers || {};
                
                let pointsFromThisRound = 0;
                const correctPlayers: string[] = [];
    
                for (const uid of Object.keys(players)) {
                    if (players[uid].isHost) continue;
    
                    const submission = currentAnswers[uid];
                    const isCorrect = submission ? checkAnswer(currentQuestion, submission.answer) : false;
                    const player = players[uid];
    
                    let points = 0;
                    if (isCorrect) {
                        points = currentQuestion.points > 0 ? currentQuestion.points : 30;
                        pointsFromThisRound += points;
                        correctPlayers.push(uid);
                    }
                    
                    player.score = (player.score || 0) + points;
                    
                    const newAnswer = {
                        questionId: currentQuestion.id,
                        isCorrect,
                        points,
                        submittedAt: submission?.submittedAt || Timestamp.now(),
                    };
                    player.answers = [...(player.answers || []), newAnswer];
                    player.currentQuestionIndex = (player.currentQuestionIndex ?? -1) + 1;
                }
                
                const newTeamScore = currentRoom.teamScore + pointsFromThisRound;
                
                transaction.update(roomRef, {
                  players,
                  teamScore: newTeamScore,
                  isAnswerRevealed: true,
                  lastQuestionResult: { correctPlayers, pointsFromThisRound },
                });
            });
        } catch (error) {
            console.error("Error tallying answers:", error);
            toast({variant: 'destructive', title: '오류', description: '답변 집계 중 오류가 발생했습니다.'});
        }
    };

    const handleNextQuestion = async () => {
        if (!isHost || !gameRoom) return;
        
        let nextQuestionIndex = gameRoom.currentQuestionIndex + 1;
        if (nextQuestionIndex >= gameRoom.allQuestions.length || gameRoom.teamScore >= gameRoom.targetScore) {
            await updateDoc(doc(db, 'team-cooperation-rooms', gameRoomId as string), { status: 'finished' });
        } else {
            await updateDoc(doc(db, 'team-cooperation-rooms', gameRoomId as string), {
                currentQuestionIndex: nextQuestionIndex,
                isAnswerRevealed: false,
                lastQuestionResult: null,
                currentAnswers: {},
                currentQuestionStartedAt: Timestamp.now(),
                currentQuestionEndsAt: new Date(Date.now() + gameRoom.timeLimitPerQuestion * 1000),
            });
        }
    };
    
    if (loadingUser || !gameRoom) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }
    
    const progressPercentage = gameRoom.targetScore > 0 ? (gameRoom.teamScore / gameRoom.targetScore) * 100 : 0;
    
    if (gameRoom.status === 'finished') {
        const missionSuccess = gameRoom.teamScore >= gameRoom.targetScore;
        const handleFinishAndSave = async () => {
            if (isSaving || !gameRoom) return;
            setIsSaving(true);
        
            try {
                const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
                await runTransaction(db, async (transaction) => {
                    const roomDoc = await transaction.get(roomRef);
                    if (!roomDoc.exists()) throw "Game room not found";
                    
                    const currentRoom = roomDoc.data() as TeamCooperationGameRoom;
                    if (currentRoom.rewardsDistributed) return;
                    
                    transaction.update(roomRef, { rewardsDistributed: true });

                    const allPlayingPlayers = Object.values(currentRoom.players).filter(p => !p.isHost);
                    const totalPlayers = allPlayingPlayers.length;

                    if (totalPlayers > 0) {
                        const baseReward = Math.floor(currentRoom.teamScore / totalPlayers);
                        const finalReward = missionSuccess ? baseReward * 2 : baseReward;
                        
                        for (const player of allPlayingPlayers) {
                            const playerRef = doc(db, 'users', player.uid);
                            if (finalReward > 0) {
                                transaction.update(playerRef, { xp: increment(finalReward), classPoints: increment(finalReward) });
                                const logRef = doc(collection(db, 'users', player.uid, 'pointLogs'));
                                transaction.set(logRef, {
                                    type: 'QUIZ_REWARD',
                                    amount: finalReward,
                                    timestamp: Timestamp.now(),
                                    description: `팀 협력전 ${missionSuccess ? '성공' : '참여'} 보상`
                                } as Omit<PointLog, 'id' | 'userId'>);
                            }
                        }
                    }
                });
            } catch (error) {
                console.error("Error saving game results:", error);
                toast({ variant: 'destructive', title: '오류', description: '게임 결과를 저장하는 중 오류가 발생했습니다.' });
            } finally {
                router.push('/dashboard');
            }
        };

        return (
            <div className="container mx-auto py-8 text-center">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        {missionSuccess ? <Image src="https://i.postimg.cc/m2PL9n9h/choejong-gyeolgwa.png" alt="미션 성공" width={150} height={150} className="mx-auto" /> : <Users className="w-20 h-20 text-muted-foreground mx-auto" />}
                        <CardTitle className="font-headline text-3xl">{missionSuccess ? '미션 성공!' : '미션 실패'}</CardTitle>
                        <CardDescription>{missionSuccess ? `축하합니다! 목표 점수 ${gameRoom.targetScore.toLocaleString()}점을 달성했습니다.` : `아쉽지만 목표 점수 ${gameRoom.targetScore.toLocaleString()}점을 달성하지 못했습니다.`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <h3 className="font-semibold mb-2">최종 팀 점수</h3>
                       <p className="text-4xl font-bold text-primary">{gameRoom.teamScore.toLocaleString()}점</p>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" onClick={handleFinishAndSave} disabled={isSaving}>
                          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          결과 저장 및 나가기
                      </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const answeredCount = gameRoom.currentAnswers ? Object.keys(gameRoom.currentAnswers).length : 0;
    const totalPlayers = Object.keys(gameRoom.players).filter(uid => uid !== gameRoom.hostId).length;
    const allAnswered = answeredCount >= totalPlayers;

    return (
        <div className="container mx-auto py-8 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{gameRoom.roomTitle}</CardTitle>
                    <CardDescription>목표 점수: {gameRoom.teamScore.toLocaleString()} / {gameRoom.targetScore.toLocaleString()} 점</CardDescription>
                    <Progress value={progressPercentage} className="mt-2" />
                </CardHeader>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>문제 {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</CardTitle>
                    {isHost && (
                         <div className="bg-secondary/50 rounded-lg p-3 my-2 flex items-center justify-between gap-2">
                            <div className="text-left">
                                <p className="text-sm font-medium text-muted-foreground">참여 코드</p>
                                <p className="text-xl font-bold font-mono tracking-widest">{gameRoom.id}</p>
                            </div>
                            <Button onClick={copyToClipboard} variant="outline" size="sm"><Copy className="w-4 h-4 mr-2" />코드 복사</Button>
                        </div>
                    )}
                    {gameRoom.timeLimitPerQuestion > 0 && (
                        <>
                        <Progress value={timeProgress} className="mt-2" />
                        {!gameRoom.isAnswerRevealed && timeRemaining > 0 && <p className="text-center text-sm text-muted-foreground mt-1">남은 시간: {Math.ceil(timeRemaining/1000)}초</p>}
                        </>
                    )}
                </CardHeader>
                <CardContent>
                        {currentQuestion ? (
                        <div className="space-y-6">
                            <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                            {currentPlayer && !isHost && (
                                <div className="space-y-4 pt-4 border-t">
                                    {(hasAnsweredCurrentQuestion || timeRemaining === 0) && !gameRoom.isAnswerRevealed ? (
                                        <p className="text-center text-primary font-semibold">답변을 제출했습니다. 호스트가 다음으로 넘어갈 때까지 기다려주세요.</p>
                                    ) : (
                                    <>
                                        {currentQuestion.type === 'subjective' && ( <Input placeholder="정답 입력" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={isSubmitting} /> )}
                                        {currentQuestion.type === 'multipleChoice' && currentQuestion.options && ( <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-1 sm:grid-cols-2 gap-2" disabled={isSubmitting}>{currentQuestion.options.map((option, index) => ( <Label key={index} htmlFor={`o-${index}`} className="flex items-center gap-3 p-3 rounded-md border hover:border-primary cursor-pointer has-[:checked]:border-primary"><RadioGroupItem value={option} id={`o-${index}`} />{option}</Label>))} </RadioGroup>)}
                                        {currentQuestion.type === 'ox' && ( <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-2 gap-4" disabled={isSubmitting}><Label htmlFor="o-o" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'O' && 'border-primary')}><RadioGroupItem value="O" id="o-o" className="sr-only"/>O</Label><Label htmlFor="o-x" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'X' && 'border-primary')}><RadioGroupItem value="X" id="o-x" className="sr-only"/>X</Label></RadioGroup> )}
                                        <Button className="w-full" onClick={handleSubmitAnswer} disabled={isSubmitting || !userAnswer}>
                                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                            제출하기
                                        </Button>
                                    </>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : ( <div className="text-center py-10 text-muted-foreground">다음 문제를 기다리고 있습니다...</div> )}
                </CardContent>
                    {isHost && (
                    <CardFooter>
                        <div className="w-full flex justify-between items-center">
                            <span>답변 제출 현황: {answeredCount} / {totalPlayers}</span>
                             <Button onClick={handleTallyAndProceed} disabled={!allAnswered && timeRemaining > 0}>정답 확인</Button>
                        </div>
                    </CardFooter>
                )}
            </Card>

            <Dialog open={!!gameRoom.isAnswerRevealed}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>퀴즈 결과</DialogTitle>
                        <DialogDescription>
                            {gameRoom.lastQuestionResult && gameRoom.lastQuestionResult.pointsFromThisRound > 0
                                ? `총 ${gameRoom.lastQuestionResult.pointsFromThisRound}점을 획득했습니다!`
                                : "아쉽지만, 정답자가 없습니다."
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <h3 className="font-semibold text-green-600">정답자</h3>
                        {gameRoom.lastQuestionResult?.correctPlayers && gameRoom.lastQuestionResult.correctPlayers.length > 0 ? (
                            gameRoom.lastQuestionResult.correctPlayers.map(uid => (
                                <div key={uid} className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span>{gameRoom.players[uid]?.nickname}</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-muted-foreground">정답자가 없습니다.</p>
                        )}
                    </div>
                     <div className="mt-4 pt-4 border-t text-center">
                        <p className="text-muted-foreground">현재 팀 점수</p>
                        <p className="text-2xl font-bold">{gameRoom.teamScore.toLocaleString()} / {gameRoom.targetScore.toLocaleString()}</p>
                     </div>
                    {isHost && (
                        <div className="flex justify-end pt-4">
                            <Button onClick={handleNextQuestion}>다음 문제로</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
