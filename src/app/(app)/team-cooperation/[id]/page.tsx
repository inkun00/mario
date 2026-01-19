'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamCooperationGameRoom, Question, TeamCooperationPlayer } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Loader2, Users, Trophy, Shield, Skull, Swords, Send, CheckCircle, XCircle, Sprout } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

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
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const [userAnswer, setUserAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const isHost = user?.uid === gameRoom?.hostId;
    const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;
    const currentQuestion = gameRoom && gameRoom.currentQuestionIndex >= 0 ? gameRoom.allQuestions[gameRoom.currentQuestionIndex] : null;
    
    const hasAnsweredCurrentQuestion = useMemo(() => {
        if (!user || !gameRoom || !currentQuestion) return false;
        const currentAnswers = gameRoom.currentAnswers || {};
        return !!currentAnswers[user.uid];
    }, [gameRoom, user, currentQuestion]);


    // Firestore listener
    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || !user) return;
        
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() } as TeamCooperationGameRoom;
                if (gameRoom && user && gameRoom.players[user.uid] && !roomData.players[user.uid]) {
                    toast({ variant: "destructive", title: "방에서 내보내졌습니다." });
                    router.push('/dashboard');
                    return;
                }
                setGameRoom(roomData);
            } else {
                toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
                router.push('/dashboard');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [gameRoomId, user, router, toast]);

    const handleSubmitAnswer = async () => {
        if (!user || !currentQuestion || !userAnswer || hasAnsweredCurrentQuestion || isHost) return;
        setIsSubmitting(true);
        try {
            const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
            await updateDoc(roomRef, {
                [`currentAnswers.${user.uid}`]: {
                    answer: userAnswer,
                    submittedAt: serverTimestamp(),
                }
            });
            toast({title: '답변 제출 완료!', description: '다른 플레이어들의 답변을 기다려주세요.'});
        } catch (error) {
            toast({variant: 'destructive', title: '오류', description: '답변 제출에 실패했습니다.'});
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNextQuestion = async () => {
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
                let correctAnswersThisRound = 0;

                for (const uid of Object.keys(currentAnswers)) {
                    const player = players[uid];
                    const submission = currentAnswers[uid];
                    const isCorrect = submission ? checkAnswer(currentQuestion, submission.answer) : false;
                    
                    let points = 0;
                    if (isCorrect) {
                        points = currentQuestion.points > 0 ? currentQuestion.points : 30;
                        correctAnswersThisRound++;
                    }
                    
                    if(player){
                       player.score = (player.score || 0) + points;
                       player.answers.push({
                           questionId: currentQuestion.id,
                           isCorrect,
                           points,
                           submittedAt: submission?.submittedAt || Timestamp.now(),
                       });
                       pointsFromThisRound += points;
                    }
                }
                
                let newTeamScore = currentRoom.teamScore + pointsFromThisRound;
                let newSeedState = currentRoom.seedState;
                let newWaterCount = currentRoom.waterCount;
                
                if (currentRoom.isSeedBombMission) {
                    if (currentRoom.seedState === 'none' && currentRoom.currentQuestionIndex === 0 && correctAnswersThisRound > 0) {
                        newSeedState = 'planted';
                        toast({ title: "🌱 씨앗 심기 성공!", description: "팀원들과 협력하여 씨앗을 키워보세요!" });
                    } else if (currentRoom.seedState === 'planted' && correctAnswersThisRound > 0) {
                        newWaterCount = (currentRoom.waterCount || 0) + correctAnswersThisRound;
                        if (newWaterCount >= (currentRoom.waterTarget || 5)) {
                            const bonus = (currentRoom.targetScore || 1000) * 0.1;
                            newTeamScore += bonus;
                            newSeedState = 'none';
                            newWaterCount = 0;
                            toast({ title: "🌳 씨앗 발아 성공!", description: `보너스 점수 ${bonus}점을 획득했습니다!` });
                        }
                    }
                }

                const nextQuestionIndex = currentRoom.currentQuestionIndex + 1;
                
                let newStatus = currentRoom.status;
                if (newTeamScore >= currentRoom.targetScore || nextQuestionIndex >= currentRoom.allQuestions.length) {
                    newStatus = 'finished';
                }

                transaction.update(roomRef, {
                  players: players,
                  teamScore: newTeamScore,
                  seedState: newSeedState,
                  waterCount: newWaterCount,
                  currentQuestionIndex: nextQuestionIndex,
                  currentAnswers: {},
                  status: newStatus,
                });
            });
        } catch (error) {
            console.error("Error moving to next question:", error);
            toast({variant: 'destructive', title: '오류', description: '다음 문제로 넘어가는 중 오류가 발생했습니다.'});
        }
    };

    if (isLoading || loadingUser) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }
    
    if (!gameRoom || !user) {
        return <div className="text-center p-8">게임을 찾을 수 없거나 참여자가 아닙니다.</div>
    }

    const allPlayers = Object.values(gameRoom.players).filter(p => !p.isHost).sort((a,b)=> b.score - a.score);
    const progressPercentage = gameRoom.targetScore > 0 ? (gameRoom.teamScore / gameRoom.targetScore) * 100 : 0;
    
    if (gameRoom.status === 'finished') {
        const missionSuccess = gameRoom.teamScore >= gameRoom.targetScore;
        return (
            <div className="container mx-auto py-8 text-center">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        {missionSuccess ? <Trophy className="w-20 h-20 text-yellow-400 mx-auto" /> : <Skull className="w-20 h-20 text-destructive mx-auto" />}
                        <CardTitle className="font-headline text-3xl">{missionSuccess ? '미션 성공!' : '미션 실패'}</CardTitle>
                        <CardDescription>{missionSuccess ? `축하합니다! 목표 점수 ${gameRoom.targetScore.toLocaleString()}점을 달성했습니다.` : `아쉽지만 목표 점수 ${gameRoom.targetScore.toLocaleString()}점을 달성하지 못했습니다.`}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <h3 className="font-semibold mb-2">최종 팀 점수</h3>
                       <p className="text-4xl font-bold text-primary">{gameRoom.teamScore.toLocaleString()}점</p>
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
                        </CardTitle>
                        <CardDescription>
                            목표 점수: {gameRoom.teamScore.toLocaleString()} / {gameRoom.targetScore.toLocaleString()} 점
                        </CardDescription>
                         <Progress value={progressPercentage} className="mt-2" />
                    </CardHeader>
                </Card>

                {gameRoom.isSeedBombMission && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><Sprout className="text-green-500"/>씨앗 폭탄 미션</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {gameRoom.seedState === 'planted' ? (
                                <div>
                                    <p className="text-center font-semibold mb-2">씨앗에 물을 주세요! (목표: {gameRoom.waterTarget || 5}개)</p>
                                    <Progress value={((gameRoom.waterCount || 0) / (gameRoom.waterTarget || 5)) * 100} />
                                    <p className="text-sm text-muted-foreground text-center mt-1">{gameRoom.waterCount || 0} / {gameRoom.waterTarget || 5}</p>
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground">첫 번째 문제를 맞춰 씨앗을 심으세요!</p>
                            )}
                        </CardContent>
                    </Card>
                )}
                
                <Card>
                    <CardHeader>
                        <CardTitle>문제 {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {currentQuestion ? (
                            <div className="space-y-6">
                                {currentQuestion.imageUrl && (
                                    <div className="relative aspect-video w-full">
                                        <Image src={currentQuestion.imageUrl} alt="질문 이미지" fill className="rounded-md object-contain" />
                                    </div>
                                )}
                                <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                                
                                {currentPlayer && !isHost && (
                                    <div className="space-y-4 pt-4 border-t">
                                        {hasAnsweredCurrentQuestion ? (
                                            <p className="text-center text-primary font-semibold">답변을 제출했습니다. 호스트가 다음 문제로 넘어갈 때까지 기다려주세요.</p>
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
                                                    <Label htmlFor="option-o" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'O' && 'border-primary bg-primary/10')}><RadioGroupItem value="O" id="option-o" className="sr-only"/>O</Label>
                                                    <Label htmlFor="option-x" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'X' && 'border-primary bg-primary/10')}><RadioGroupItem value="X" id="option-x" className="sr-only"/>X</Label>
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
                            </div>
                        ) : (
                             <div className="text-center py-10 text-muted-foreground">다음 문제를 기다리고 있습니다...</div>
                        )}
                    </CardContent>
                     {isHost && (
                        <CardFooter>
                           <Button onClick={handleNextQuestion}>다음 문제로</Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
            <aside className="w-full lg:w-80 xl:w-96">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Users/> 팀원 기여도</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-96">
                            <div className="space-y-2 pr-4">
                                {allPlayers.map(p => (
                                    <div key={p.uid} className="flex items-center justify-between p-2 rounded-md bg-secondary">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="w-8 h-8">
                                                <PixelAvatar pixels={p.pixelAvatar ? JSON.parse(p.pixelAvatar) : null} />
                                                <AvatarFallback>{p.nickname.substring(0,1)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm font-medium truncate">{p.nickname}</span>
                                        </div>
                                        <span className="font-bold text-primary">{p.score.toLocaleString()}점</span>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </aside>
        </div>
    );
}
