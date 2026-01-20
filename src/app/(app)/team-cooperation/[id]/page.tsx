'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, runTransaction, Timestamp, arrayUnion, deleteField } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamCooperationGameRoom, Question, TeamCooperationPlayer, GameItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, Trophy, Skull, Send, Sprout, CheckCircle, XCircle } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';


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

    // Client-side state for the physics game
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [angle, setAngle] = useState(45);
    const [isCharging, setIsCharging] = useState(false);
    const [chargePower, setChargePower] = useState(0);
    const [mode, setMode] = useState<'SEED' | 'WATER'>('SEED');
    const chargeRequestRef = useRef<number | null>(null);
    const projectileRef = useRef<any>(null);
    const cameraXRef = useRef(0);
    const [message, setMessage] = useState('스페이스바를 꾹 눌러 파워를 조절하세요!');
    const [userAnswer, setUserAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Game constants
    const WORLD_WIDTH = 2400; 
    const VIEWPORT_WIDTH = 800;
    const VIEWPORT_HEIGHT = 600;
    const GRAVITY = 0.22;
    const LAUNCHER_X = 100;
    const MAX_POWER = 100;
    const SPLASH_RADIUS = 120;
    const MAX_PLANT_LEVEL = 10;
    const PLANT_EMOJIS = [ '🌳', '🌲', '🌴', '🎋', '🎍', '🌵', '🎄', '🌹', '🌷', '🌸', '🌼', '🌻', '🌺', '🪻', '💐', '💮', '🏵️', '🪷', '🥀', '🌿', '☘️', '🍀', '🌾', '🪴', '🍄', '🌱'];

    const isHost = user?.uid === gameRoom?.hostId;
    const currentPlayer = user && gameRoom ? gameRoom.players[user.uid] : null;
    const currentQuestion = gameRoom && gameRoom.currentQuestionIndex >= 0 ? gameRoom.allQuestions[gameRoom.currentQuestionIndex] : null;

    // Firestore listener
    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || !user) return;
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
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

    const hasAnsweredCurrentQuestion = useMemo(() => {
        if (!gameRoom || !user || !currentQuestion) return false;
        return !!gameRoom.currentAnswers?.[user.uid];
    }, [gameRoom, user, currentQuestion]);

    const handleCollision = useCallback(async (x: number, y: number, type: 'SEED' | 'WATER') => {
        if (!gameRoom || typeof gameRoomId !== 'string') return;
        
        const gridX = Math.min(WORLD_WIDTH - 1, Math.max(0, Math.floor(x)));
        const terrainY = gameRoom.terrain[gridX];
        
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId);

        try {
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw "Room not found";
                const currentRoom = roomDoc.data() as TeamCooperationGameRoom;

                let updatedPlants = [...currentRoom.plants];
                let pointsFromThisAction = 0;

                if (type === 'SEED') {
                    const randomEmoji = PLANT_EMOJIS[Math.floor(Math.random() * PLANT_EMOJIS.length)];
                    updatedPlants.push({
                        id: Date.now().toString(),
                        x: x,
                        y: terrainY,
                        emoji: randomEmoji,
                        level: 1
                    });
                    pointsFromThisAction = 50; // Bonus for planting a new seed
                    setMessage('새로운 식물이 안착될 준비를 마쳤습니다!');
                } else if (type === 'WATER') {
                    let hitCount = 0;
                    updatedPlants = updatedPlants.map(item => {
                        const dist = Math.sqrt(Math.pow(item.x - x, 2) + Math.pow(item.y - terrainY, 2));
                        if (dist < SPLASH_RADIUS && item.level < MAX_PLANT_LEVEL) {
                            hitCount++;
                            pointsFromThisAction += 10 * item.level; // More points for growing bigger plants
                            return { ...item, level: item.level + 1 };
                        }
                        return item;
                    });
                     setMessage(hitCount > 0 ? `${hitCount}개의 식물이 무럭무럭 자라납니다!` : '물폭탄이 땅을 적셨습니다.');
                }
                
                const nextQuestionIndex = currentRoom.currentQuestionIndex + 1;
                const newTeamScore = (currentRoom.teamScore || 0) + pointsFromThisAction;

                const updateData: { [key: string]: any } = {
                    plants: updatedPlants,
                    teamScore: newTeamScore,
                    phase: 'QUIZ',
                    plantingTurnUid: deleteField(),
                    currentQuestionIndex: nextQuestionIndex,
                };
                
                if (newTeamScore >= currentRoom.targetScore || nextQuestionIndex >= currentRoom.allQuestions.length) {
                    updateData.status = 'finished';
                }

                transaction.update(roomRef, updateData);
            });

             setTimeout(() => {
                projectileRef.current = null;
                cameraXRef.current = 0;
                setChargePower(0);
                setMessage('준비 완료! 다시 스페이스바를 누르세요.');
            }, 1500);

        } catch (error) {
            console.error("Error handling collision:", error);
            toast({ variant: 'destructive', title: '오류', description: '충돌 처리 중 오류가 발생했습니다.'});
        }
    }, [gameRoom, gameRoomId, toast]);

    // Game rendering loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameRoom) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
            ctx.save();
            ctx.translate(-cameraXRef.current, 0);

            const sky = ctx.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
            sky.addColorStop(0, '#f0f9ff'); sky.addColorStop(1, '#e0f2fe');
            ctx.fillStyle = sky;
            ctx.fillRect(cameraXRef.current, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

            ctx.beginPath(); ctx.moveTo(0, VIEWPORT_HEIGHT);
            gameRoom.terrain.forEach((y, x) => ctx.lineTo(x, y));
            ctx.lineTo(WORLD_WIDTH, VIEWPORT_HEIGHT);
            ctx.fillStyle = '#2d1e12'; ctx.fill();
            
            ctx.beginPath(); gameRoom.terrain.forEach((y, x) => ctx.lineTo(x, y));
            ctx.strokeStyle = '#065f46'; ctx.lineWidth = 4; ctx.stroke();
            
            const lY = gameRoom.terrain[LAUNCHER_X];
            ctx.save(); ctx.translate(LAUNCHER_X, lY - 15); ctx.rotate((-angle * Math.PI) / 180);
            ctx.fillStyle = '#334155'; ctx.fillRect(0, -8, 60, 16);
            ctx.restore();
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(LAUNCHER_X, lY - 15, 22, 0, Math.PI * 2); ctx.fill();

            gameRoom.plants.forEach(item => {
                ctx.save();
                ctx.translate(item.x, item.y);
                const fontSize = 15 + (item.level * 3.5); 
                ctx.font = `${fontSize}px serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const wobble = Math.sin(Date.now() * 0.0015 + parseInt(item.id)) * 1.5;
                ctx.rotate(wobble * 0.01);
                ctx.fillText(item.level === 1 ? '🌱' : item.emoji, 0, 0);
                ctx.restore();
            });

            const proj = projectileRef.current;
            if (proj) {
                proj.x += proj.vx; proj.y += proj.vy; proj.vy += GRAVITY;
                proj.trail.push({ x: proj.x, y: proj.y });
                if (proj.trail.length > 30) proj.trail.shift();

                ctx.beginPath(); proj.trail.forEach((p: {x: number; y: number}) => ctx.lineTo(p.x, p.y));
                ctx.strokeStyle = proj.type === 'SEED' ? 'rgba(67, 20, 7, 0.3)' : 'rgba(14, 165, 233, 0.3)';
                ctx.lineWidth = 5; ctx.stroke();

                ctx.beginPath(); ctx.arc(proj.x, proj.y, 10, 0, Math.PI * 2);
                ctx.fillStyle = proj.type === 'SEED' ? '#431407' : '#0284c7';
                ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

                if (proj.type === 'WATER' && proj.y > gameRoom.terrain[Math.floor(proj.x)] - 150) {
                    ctx.beginPath(); ctx.arc(proj.x, proj.y, SPLASH_RADIUS, 0, Math.PI * 2);
                    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)'; ctx.fill();
                }

                cameraXRef.current = Math.max(0, Math.min(proj.x - VIEWPORT_WIDTH / 2, WORLD_WIDTH - VIEWPORT_WIDTH));

                const gx = Math.floor(proj.x);
                if (gx < 0 || gx >= WORLD_WIDTH || proj.y >= gameRoom.terrain[gx]) {
                    handleCollision(proj.x, proj.y, proj.type);
                    projectileRef.current = null;
                }
            }

            ctx.restore();
            animationFrameId = window.requestAnimationFrame(render);
        };
        render();
        return () => window.cancelAnimationFrame(animationFrameId);
    }, [gameRoom, angle, handleCollision]);

    const fire = (power: number) => {
        if (!gameRoom) return;
        setMessage('발사!');
        const rad = (angle * Math.PI) / 180;
        const v0 = power * 0.38;
        const startY = gameRoom.terrain[LAUNCHER_X] - 25;
        projectileRef.current = { x: LAUNCHER_X, y: startY, vx: Math.cos(rad) * v0, vy: -Math.sin(rad) * v0, type: mode, trail: [] };
    };

    // Power charge logic
    useEffect(() => {
        const isPlantingTurn = gameRoom?.phase === 'PLANTING' && gameRoom?.plantingTurnUid === user?.uid;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && isPlantingTurn && !isCharging && !projectileRef.current && !e.repeat) {
                e.preventDefault();
                setIsCharging(true);
                setChargePower(1);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && isCharging) {
                e.preventDefault();
                setIsCharging(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isCharging, gameRoom, user]);
    
    useEffect(() => {
        if (!isCharging && chargePower > 0 && !projectileRef.current) {
          fire(chargePower);
        }
    }, [isCharging, chargePower, fire]);

    useEffect(() => {
        if (isCharging) {
            const updateCharge = () => {
                setChargePower(prev => Math.min(prev + 3.0, MAX_POWER));
                chargeRequestRef.current = requestAnimationFrame(updateCharge);
            };
            chargeRequestRef.current = requestAnimationFrame(updateCharge);
        } else {
            if (chargeRequestRef.current) cancelAnimationFrame(chargeRequestRef.current);
        }
        return () => {
            if (chargeRequestRef.current) cancelAnimationFrame(chargeRequestRef.current);
        };
    }, [isCharging]);

    const handleSubmitAnswer = async () => {
        if (!user || !currentQuestion || !userAnswer || hasAnsweredCurrentQuestion || isHost) return;
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
                    
                    if (isCorrect) {
                        const points = currentQuestion.points > 0 ? currentQuestion.points : 30;
                        pointsFromThisRound += points;
                        players[uid].score = (players[uid].score || 0) + points;
                        correctPlayers.push(uid);
                    }
                }
                
                const newTeamScore = currentRoom.teamScore + pointsFromThisRound;
                
                transaction.update(roomRef, {
                  players,
                  teamScore: newTeamScore,
                  phase: 'RESULT',
                  lastQuestionResult: { correctPlayers, pointsFromThisRound },
                  currentAnswers: {},
                });
            });
        } catch (error) {
            console.error("Error tallying answers:", error);
            toast({variant: 'destructive', title: '오류', description: '답변 집계 중 오류가 발생했습니다.'});
        }
    };

    const handleProceedToNextStep = async () => {
        if (!isHost || !gameRoom) return;
        try {
            await runTransaction(db, async (transaction) => {
                const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId as string);
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw "Room not found";
                const currentRoom = roomDoc.data() as TeamCooperationGameRoom;
    
                const correctPlayers = currentRoom.lastQuestionResult?.correctPlayers || [];
                
                const updateData: { [key: string]: any } = {
                    lastQuestionResult: null,
                };
    
                let nextQuestionIndex = currentRoom.currentQuestionIndex;

                if (correctPlayers.length > 0) {
                    updateData.phase = 'PLANTING';
                    updateData.plantingTurnUid = correctPlayers[Math.floor(Math.random() * correctPlayers.length)];
                } else {
                    updateData.phase = 'QUIZ';
                    nextQuestionIndex++;
                    updateData.currentQuestionIndex = nextQuestionIndex;
                    updateData.plantingTurnUid = deleteField();
                }
                
                if (nextQuestionIndex >= currentRoom.allQuestions.length || currentRoom.teamScore >= currentRoom.targetScore) {
                    updateData.status = 'finished';
                }
    
                transaction.update(roomRef, updateData);
            });
        } catch (error) {
            console.error("Error proceeding to next step:", error);
            toast({variant: 'destructive', title: '오류', description: '다음 단계로 진행하는 중 오류가 발생했습니다.'});
        }
    };
    
    if (loadingUser || !gameRoom) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }
    
    const progressPercentage = gameRoom.targetScore > 0 ? (gameRoom.teamScore / gameRoom.targetScore) * 100 : 0;
    const isPlantingTurn = gameRoom.phase === 'PLANTING' && gameRoom.plantingTurnUid === user?.uid;

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
        <div className="container mx-auto py-8 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-2xl">{gameRoom.roomTitle}</CardTitle>
                    <CardDescription>목표 점수: {gameRoom.teamScore.toLocaleString()} / {gameRoom.targetScore.toLocaleString()} 점</CardDescription>
                    <Progress value={progressPercentage} className="mt-2" />
                </CardHeader>
            </Card>

            {gameRoom.phase === 'QUIZ' && (
                 <Card>
                    <CardHeader>
                        <CardTitle>문제 {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</CardTitle>
                    </CardHeader>
                    <CardContent>
                         {currentQuestion ? (
                            <div className="space-y-6">
                                <p className="text-lg font-medium whitespace-pre-wrap">{currentQuestion.question}</p>
                                {currentPlayer && !isHost && (
                                    <div className="space-y-4 pt-4 border-t">
                                        {hasAnsweredCurrentQuestion ? (
                                            <p className="text-center text-primary font-semibold">답변을 제출했습니다. 호스트가 다음으로 넘어갈 때까지 기다려주세요.</p>
                                        ) : (
                                        <>
                                            {currentQuestion.type === 'subjective' && ( <Input placeholder="정답 입력" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} disabled={isSubmitting} /> )}
                                            {currentQuestion.type === 'multipleChoice' && currentQuestion.options && ( <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-1 sm:grid-cols-2 gap-2" disabled={isSubmitting}>{currentQuestion.options.map((option, index) => ( <Label key={index} htmlFor={`o-${index}`} className="flex items-center gap-3 p-3 rounded-md border hover:border-primary cursor-pointer has-[:checked]:border-primary"><RadioGroupItem value={option} id={`o-${index}`} />{option}</Label>))} </RadioGroup>)}
                                            {currentQuestion.type === 'ox' && ( <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-2 gap-4" disabled={isSubmitting}><Label htmlFor="o-o" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'O' && 'border-primary')}><RadioGroupItem value="O" id="o-o" className="sr-only"/>O</Label><Label htmlFor="o-x" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'X' && 'border-primary')}><RadioGroupItem value="X" id="o-x" className="sr-only"/>X</Label></RadioGroup> )}
                                            <Button className="w-full" onClick={handleSubmitAnswer} disabled={isSubmitting || !userAnswer}><Send className="w-4 h-4 mr-2" />제출하기</Button>
                                        </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : ( <div className="text-center py-10 text-muted-foreground">다음 문제를 기다리고 있습니다...</div> )}
                    </CardContent>
                     {isHost && (
                        <CardFooter><Button onClick={handleTallyAndProceed}>정답 확인</Button></CardFooter>
                    )}
                </Card>
            )}

            {gameRoom.phase === 'RESULT' && (
                <Card>
                    <CardHeader>
                        <CardTitle>퀴즈 결과</CardTitle>
                        <CardDescription>
                            {gameRoom.lastQuestionResult?.correctPlayers && gameRoom.lastQuestionResult.correctPlayers.length > 0
                                ? `총 ${gameRoom.lastQuestionResult.pointsFromThisRound}점을 획득했습니다!`
                                : "아쉽지만, 정답자가 없습니다."
                            }
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
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
                    </CardContent>
                    {isHost && (
                        <CardFooter>
                            <Button onClick={handleProceedToNextStep}>다음으로</Button>
                        </CardFooter>
                    )}
                </Card>
            )}
            
            {gameRoom.phase === 'PLANTING' && (
                <Card>
                    <CardHeader>
                         <CardTitle>
                            {gameRoom.plantingTurnUid === user?.uid ? "당신의 차례입니다! 씨앗 또는 물 폭탄을 발사하세요!" : `${gameRoom.players[gameRoom.plantingTurnUid || '']?.nickname || ''}님이 발사 준비 중입니다.`}
                        </CardTitle>
                        <CardDescription>{message}</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <div className="relative rounded-lg overflow-hidden shadow-inner bg-white border aspect-video">
                            <canvas ref={canvasRef} width={VIEWPORT_WIDTH} height={VIEWPORT_HEIGHT} className="w-full h-full" />
                            {isCharging && isPlantingTurn && (
                                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 w-3/4 max-w-md px-4 py-2 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border">
                                    <div className="flex justify-between mb-1 text-slate-900 font-bold text-xs"><p>파워</p><p>{Math.round(chargePower)}%</p></div>
                                    <Progress value={chargePower} />
                                </div>
                            )}
                        </div>

                       {isPlantingTurn && (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center mt-4">
                            <div className="space-y-2">
                                <Label>각도: {angle}°</Label>
                                <Input type="range" min="0" max="90" value={angle} onChange={(e) => setAngle(parseInt(e.target.value))} className="w-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
                                <Button onClick={() => setMode('SEED')} variant={mode === 'SEED' ? 'default' : 'ghost'}>🌰 씨앗 폭탄</Button>
                                <Button onClick={() => setMode('WATER')} variant={mode === 'WATER' ? 'default' : 'ghost'}>💧 물 폭탄</Button>
                            </div>
                        </div>
                       )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
