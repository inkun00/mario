
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction, writeBatch, increment, getDoc, collection, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamBattleGameRoom, Question, TeamBattlePlayer, User, PointLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Crown, Shield, Send, CheckCircle, XCircle, Clock, Swords } from 'lucide-react';
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

export default function TeamBattleGamePage() {
    const { id: gameRoomId } = useParams();
    const router = useRouter();
    const [user, loadingUser] = useAuthState(auth);
    const [gameRoom, setGameRoom] = useState<TeamBattleGameRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    
    const [userAnswer, setUserAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [gameTimeRemaining, setGameTimeRemaining] = useState(0);
    const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const isHost = user?.uid === gameRoom?.hostId;
    const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;
    
    const currentQuestion = useMemo(() => {
        if (!gameRoom || !currentPlayer || !currentPlayer.questionOrder || typeof currentPlayer.currentQuestionIndex !== 'number') return null;
        const questionIndex = currentPlayer.questionOrder[currentPlayer.currentQuestionIndex];
        return gameRoom.allQuestions[questionIndex] || null;
    }, [gameRoom, currentPlayer]);

    const hasAnsweredCurrentQuestion = useMemo(() => {
        if (!currentPlayer || !currentQuestion) return false;
        return currentPlayer.answers?.some(a => a.questionId === currentQuestion.id);
    }, [currentPlayer, currentQuestion]);

    // Firestore listener
    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || !user) return;
        
        const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() } as TeamBattleGameRoom;
                setGameRoom(roomData);
            } else {
                toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
                router.push('/dashboard');
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [gameRoomId, user, router, toast]);

    // Game Timer Logic
    useEffect(() => {
        if (!gameRoom || !gameRoom.gameEndTime || gameRoom.status !== 'playing') return;

        const interval = setInterval(async () => {
            const remaining = Math.max(0, (gameRoom.gameEndTime as any).toDate().getTime() - Date.now());
            setGameTimeRemaining(remaining);
            if (remaining === 0 && isHost) {
                clearInterval(interval);
                await updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), { status: 'finished' });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [gameRoom, isHost, gameRoomId]);

    const handleSubmitAnswer = async () => {
        if (!user || !currentPlayer || !currentQuestion || !userAnswer || hasAnsweredCurrentQuestion || isHost) return;
        setIsSubmitting(true);
        
        try {
            await runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw "Game room not found";

                const currentRoom = roomDoc.data() as TeamBattleGameRoom;
                const player = currentRoom.players[user.uid];
                
                if (!player || !player.teamId) throw "Player or team not found";

                const isCorrect = checkAnswer(currentQuestion, userAnswer);
                let points = 0;
                if (isCorrect) {
                    const basePoints = currentQuestion.points > 0 ? currentQuestion.points : 30;
                    points = basePoints; // Simplified points for now
                }
                
                const teamScoreField = player.teamId === 'teamA' ? 'teams.teamA.score' : 'teams.teamB.score';
                const opponentTeamScoreField = player.teamId === 'teamA' ? 'teams.teamB.score' : 'teams.teamA.score';

                const newAnswer = {
                    questionId: currentQuestion.id,
                    isCorrect,
                    points,
                    submittedAt: Timestamp.now(),
                };
                const newAnswers = [...(player.answers || []), newAnswer];
                const nextQuestionIndex = (player.currentQuestionIndex ?? -1) + 1;
                
                transaction.update(roomRef, {
                    [teamScoreField]: increment(points),
                    [opponentTeamScoreField]: increment(-points),
                    [`players.${user.uid}.answers`]: newAnswers,
                    [`players.${user.uid}.score`]: increment(points),
                    [`players.${user.uid}.currentQuestionIndex`]: nextQuestionIndex
                });
            });
            setUserAnswer('');
        } catch (error) {
            console.error("Error submitting answer:", error);
            toast({variant: 'destructive', title: '오류', description: '답변 제출에 실패했습니다.'});
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleEndGame = async () => {
        await updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), { status: 'finished' });
        setShowEndGameConfirm(false);
    }
    
    const { teamAScore, teamBScore, totalScore, teamAPercentage, teamBPercentage } = useMemo(() => {
        const teamAScore = gameRoom?.teams.teamA.score || 0;
        const teamBScore = gameRoom?.teams.teamB.score || 0;
        const total = teamAScore + teamBScore;
        const teamAPercentage = total > 0 ? (teamAScore / total) * 100 : 50;
        const teamBPercentage = 100 - teamAPercentage;
        return { teamAScore, teamBScore, totalScore: total, teamAPercentage, teamBPercentage };
    }, [gameRoom?.teams]);

    useEffect(() => {
        if (gameRoom?.status === 'playing' && (teamAScore <= 0 || teamBScore <= 0) && totalScore > 200) { // totalScore > 200 to avoid initial state trigger
             if (isHost) {
                updateDoc(doc(db, 'team-battle-rooms', gameRoomId as string), { status: 'finished' });
            }
        }
    }, [teamAScore, teamBScore, totalScore, gameRoom?.status, isHost, gameRoomId]);

    const winnerTeam = useMemo(() => {
        if (gameRoom?.status !== 'finished') return null;
        return teamAScore > teamBScore ? gameRoom.teams.teamA : (teamBScore > teamAScore ? gameRoom.teams.teamB : null);
    }, [gameRoom, teamAScore, teamBScore]);


    if (isLoading || loadingUser) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }

    if (!gameRoom || !user) {
        return <div className="text-center p-8">게임을 찾을 수 없거나 참여자가 아닙니다.</div>
    }

    if (gameRoom.status === 'finished') {
        const handleFinishAndSave = async () => {
            if (isSaving || !gameRoom) return;
            setIsSaving(true);
        
            try {
                const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
                await runTransaction(db, async (transaction) => {
                    const roomDoc = await transaction.get(roomRef);
                    if (!roomDoc.exists()) throw "Game room not found.";

                    const currentRoomData = roomDoc.data() as TeamBattleGameRoom;
                    if (currentRoomData.rewardsDistributed) return;
                    
                    transaction.update(roomRef, { rewardsDistributed: true });

                    const allPlayingPlayers = Object.values(currentRoomData.players).filter(p => !p.isHost);
                    const totalPlayers = allPlayingPlayers.length;
                    
                    if (totalPlayers > 0) {
                        const teamAScoreTx = currentRoomData.teams.teamA.score || 0;
                        const teamBScoreTx = currentRoomData.teams.teamB.score || 0;
                        const winnerTeamIdTx = teamAScoreTx > teamBScoreTx ? 'teamA' : (teamBScoreTx > teamAScoreTx ? 'teamB' : null);

                        const baseReward = 10 * totalPlayers;
                        const losingTeamReward = baseReward;
                        const winningTeamReward = baseReward * 2;
                        
                        for (const player of allPlayingPlayers) {
                            const playerRef = doc(db, 'users', player.uid);
                            let points = 0;
                            let description = '';
            
                            if (!winnerTeamIdTx) { // Draw
                                points = losingTeamReward;
                                description = '팀 대항전 무승부';
                            } else if (player.teamId === winnerTeamIdTx) {
                                points = winningTeamReward;
                                description = '팀 대항전 승리';
                            } else {
                                points = losingTeamReward;
                                description = '팀 대항전 참여';
                            }
            
                            if (points > 0) {
                                transaction.update(playerRef, {
                                    xp: increment(points),
                                    classPoints: increment(points)
                                });
                                const logRef = doc(collection(db, 'users', player.uid, 'pointLogs'));
                                transaction.set(logRef, {
                                    type: 'QUIZ_REWARD',
                                    amount: points,
                                    timestamp: Timestamp.now(),
                                    description
                                } as Omit<PointLog, 'id' | 'userId'>);
                            }
                        }
                    }
                });
            } catch (error) {
                console.error("Error saving game results:", error);
                toast({ variant: 'destructive', title: '오류', description: '게임 결과를 저장하는 중 오류가 발생했습니다.'});
            } finally {
                router.push('/dashboard');
            }
        };

        return (
            <div className="container mx-auto py-8 text-center">
                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <Image src="https://i.postimg.cc/m2PL9n9h/choejong-gyeolgwa.png" alt="게임 종료" width={150} height={150} className="mx-auto" />
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
                            <span className="font-bold">{teamAScore}점</span>
                        </div>
                         <div className="flex justify-between p-3 rounded-lg bg-blue-100/50 dark:bg-blue-900/50">
                            <span className="font-bold text-blue-600">블루 팀</span>
                            <span className="font-bold">{teamBScore}점</span>
                        </div>
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

    const minutes = Math.floor(gameTimeRemaining / 60000);
    const seconds = Math.floor((gameTimeRemaining % 60000) / 1000);

    return (
        <div className="container mx-auto py-8 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl flex justify-between items-center">
                        <span>{gameRoom.roomTitle}</span>
                        <div className="flex items-center gap-2 text-lg font-mono">
                           <Clock className="w-5 h-5"/>
                           <span>{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="w-full h-8 flex rounded-full overflow-hidden border-2 border-slate-500">
                        <div className="bg-red-500 h-full transition-all duration-500" style={{width: `${teamAPercentage}%`}}></div>
                        <div className="bg-blue-500 h-full transition-all duration-500" style={{width: `${teamBPercentage}%`}}></div>
                    </div>
                     <div className="flex justify-between mt-2 font-bold">
                        <span className="text-red-600">{teamAScore.toLocaleString()}점</span>
                        <span className="text-blue-600">{teamBScore.toLocaleString()}점</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Swords className="w-5 h-5"/>
                        {currentPlayer && `문제 ${currentPlayer.currentQuestionIndex! + 1}`}
                    </CardTitle>
                </CardHeader>
                 <CardContent>
                    {currentQuestion && !isHost ? (
                        <div className="space-y-6">
                            {currentQuestion.imageUrl && (
                                <div className="relative aspect-video w-full">
                                    <Image src={currentQuestion.imageUrl} alt="질문 이미지" fill className="rounded-md object-contain" />
                                </div>
                            )}
                            <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                            
                            <div className="space-y-4 pt-4 border-t">
                                {hasAnsweredCurrentQuestion ? (
                                    <p className="text-center text-primary font-semibold">답변 완료! 다음 문제를 기다려주세요.</p>
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
                        
                        </div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            {isHost ? "플레이어들이 문제를 풀고 있습니다." : "다음 문제를 기다리고 있습니다..."}
                        </div>
                    )}
                 </CardContent>
                 {isHost && (
                    <CardFooter>
                       <Button variant="destructive" onClick={() => setShowEndGameConfirm(true)}>게임 강제 종료</Button>
                    </CardFooter>
                 )}
            </Card>

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
