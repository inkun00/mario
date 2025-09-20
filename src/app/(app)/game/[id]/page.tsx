'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, Question } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Crown, HelpCircle, Loader2, Shield, Star, Swords, Zap, Lightbulb, ChevronsRight, Gift, TrendingDown, Repeat, Bomb } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';


interface GameBlock {
  id: number;
  type: 'question' | 'mystery';
  question?: Question;
  isFlipping: boolean;
  isOpened: boolean;
}

type MysteryEffectType = 'bonus' | 'double' | 'penalty' | 'half' | 'swap';

interface MysteryEffect {
    type: MysteryEffectType;
    title: string;
    description: string;
    icon: React.ReactNode;
    value?: number;
}

// Function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};


export default function GamePage() {
  const { id: gameRoomId } = useParams();
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [blocks, setBlocks] = useState<GameBlock[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showMysteryBoxPopup, setShowMysteryBoxPopup] = useState(false);
  const [mysteryBoxEffect, setMysteryBoxEffect] = useState<MysteryEffect | null>(null);
  const [playerForSwap, setPlayerForSwap] = useState<string | null>(null);


  // Fetch GameRoom and GameSet data
  useEffect(() => {
    if (!gameRoomId) return;

    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
        setGameRoom(roomData);

        // Fetch GameSet if not already fetched
        if (!gameSet && roomData.gameSetId) {
          const setRef = doc(db, 'game-sets', roomData.gameSetId);
          const setSnap = await getDoc(setRef);
          if (setSnap.exists()) {
            const gameSetData = { id: setSnap.id, ...setSnap.data() } as GameSet;
            setGameSet(gameSetData);
          } else {
             toast({ variant: 'destructive', title: '오류', description: '게임 세트를 찾을 수 없습니다.' });
             router.push('/dashboard');
          }
        }
      } else {
        toast({ variant: 'destructive', title: '오류', description: '게임방을 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
      setIsLoading(false);
    }, (error) => {
        console.error("Error fetching game room: ", error);
        toast({ variant: 'destructive', title: '오류', description: '게임방 정보를 불러오는 중 오류가 발생했습니다.' });
        setIsLoading(false);
        router.push('/dashboard');
    });

    return () => unsubscribe();
  }, [gameRoomId, router, toast, gameSet]);
  
  // Update players and turn status when gameRoom or user changes
  useEffect(() => {
    if (!gameRoom || !user) return;
    setPlayers(Object.values(gameRoom.players).sort((a, b) => b.score - a.score));
    setIsMyTurn(gameRoom.currentTurn === user.uid);
  }, [gameRoom, user]);


  // Initialize game blocks
  useEffect(() => {
    if (!gameSet || !gameRoom || blocks.length > 0) return;

    const questionItems: GameBlock[] = gameSet.questions.map((q, i) => ({
        id: i,
        type: 'question',
        question: q,
        isFlipping: false,
        isOpened: !!gameRoom.gameState[i]
    }));

    let mysteryItems: GameBlock[] = [];
    if(gameRoom.mysteryBoxEnabled) {
        const mysteryCount = Math.round(gameSet.questions.length * 0.3);
        mysteryItems = Array.from({ length: mysteryCount }, (_, i) => ({
            id: gameSet.questions.length + i,
            type: 'mystery',
            isFlipping: false,
            isOpened: false // Mystery boxes can be reopened
        }));
    }
    
    const allItems = [...questionItems, ...mysteryItems];
    setBlocks(shuffleArray(allItems));

  }, [gameSet, gameRoom, blocks.length]);
  
  const handleNextTurn = async () => {
      if (!gameRoom) return;

      const roomRef = doc(db, 'game-rooms', gameRoomId as string);
      const playerUIDs = Object.keys(gameRoom.players);
      const currentTurnIndex = playerUIDs.indexOf(gameRoom.currentTurn);
      const nextTurnIndex = (currentTurnIndex + 1) % playerUIDs.length;
      const nextTurnUID = playerUIDs[nextTurnIndex];

      await updateDoc(roomRef, { currentTurn: nextTurnUID });
  };
  
  const handleBlockClick = (block: GameBlock) => {
    const isTurnRestricted = gameRoom?.joinType === 'remote' && !isMyTurn;
    if (isTurnRestricted || block.isOpened || block.isFlipping) return;

    // 1. Start flipping animation
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isFlipping: true } : b));
    
    // 2. After animation, show popup and mark as opened
    setTimeout(() => {
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isFlipping: false, isOpened: true } : b));

      if (block.type === 'question' && block.question) {
        setCurrentQuestion(block.question);
        
        let points = block.question.points;
        if (points === -1) { // Random points
            points = (Math.floor(Math.random() * 5) + 1) * 10;
        }
        setCurrentPoints(points);
        setShowHint(false);
        setUserAnswer('');
        
        const roomRef = doc(db, 'game-rooms', gameRoomId as string);
        updateDoc(roomRef, { [`gameState.${block.id}`]: 'answered' });
      } else { // Mystery Box
        const effects: MysteryEffectType[] = ['bonus', 'double', 'penalty', 'half', 'swap'];
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];
        let effectDetails: MysteryEffect;

        const randomPoints = (Math.floor(Math.random() * 5) + 1) * 10;

        switch (randomEffect) {
            case 'bonus':
                effectDetails = { type: 'bonus', title: '점수 보너스!', description: `축하합니다! ${randomPoints}점을 추가로 획득합니다.`, icon: <Star className="w-16 h-16 text-yellow-400"/>, value: randomPoints };
                break;
            case 'double':
                effectDetails = { type: 'double', title: '점수 2배!', description: '행운의 주인공! 현재까지 누적된 모든 점수가 2배가 됩니다.', icon: <ChevronsRight className="w-16 h-16 text-green-500"/> };
                break;
            case 'penalty':
                effectDetails = { type: 'penalty', title: '점수 감점...', description: `이런! ${randomPoints}점이 감점됩니다.`, icon: <Bomb className="w-16 h-16 text-destructive"/>, value: -randomPoints };
                break;
            case 'half':
                effectDetails = { type: 'half', title: '점수 반감', description: '치명적인 실수! 현재까지 누적된 모든 점수가 절반으로 줄어듭니다.', icon: <TrendingDown className="w-16 h-16 text-orange-500"/> };
                break;
            case 'swap':
                effectDetails = { type: 'swap', title: '점수 바꾸기!', description: '전략적 선택! 다른 플레이어와 점수를 바꿀 수 있습니다.', icon: <Repeat className="w-16 h-16 text-blue-500"/> };
                break;
        }
        setMysteryBoxEffect(effectDetails);
        setShowMysteryBoxPopup(true);
      }
    }, 800); // Animation duration
  };

  const handleShowHint = () => {
    setShowHint(true);
    setCurrentPoints(prev => Math.floor(prev / 2));
  };

  const handleCloseDialogs = () => {
    setCurrentQuestion(null);
    setShowMysteryBoxPopup(false);
    setMysteryBoxEffect(null);
    setPlayerForSwap(null);
  }

  const handleSubmitAnswer = async () => {
    if (!currentQuestion || !gameRoom || !userAnswer) {
      toast({ variant: 'destructive', title: '오류', description: '답변을 선택하거나 입력해주세요.'});
      return;
    }

    setIsSubmitting(true);

    const isCorrect = (currentQuestion.type === 'subjective' && userAnswer.trim().toLowerCase() === currentQuestion.answer?.trim().toLowerCase())
      || (currentQuestion.type !== 'subjective' && userAnswer === currentQuestion.correctAnswer);

    const pointsToAward = isCorrect ? currentPoints : 0;

    if (isCorrect) {
        toast({
            title: '정답입니다!',
            description: `${pointsToAward}점을 획득했습니다!`,
        });
    } else {
        toast({
            variant: 'destructive',
            title: '오답입니다...',
            description: `정답은 "${currentQuestion.answer || currentQuestion.correctAnswer}" 입니다.`,
        });
    }

    try {
        const roomRef = doc(db, 'game-rooms', gameRoomId as string);
        const currentTurnUID = gameRoom.currentTurn;
        
        await updateDoc(roomRef, {
            [`players.${currentTurnUID}.score`]: increment(pointsToAward)
        });

        await handleNextTurn();
    } catch (error) {
        console.error("Error submitting answer: ", error);
        toast({ variant: 'destructive', title: '오류', description: '답변 제출 중 오류가 발생했습니다.'});
    } finally {
        setIsSubmitting(false);
        handleCloseDialogs();
    }
  };

  const handleMysteryEffect = async () => {
    if (!mysteryBoxEffect || !gameRoom) return;

    setIsSubmitting(true);
    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    const currentTurnUID = gameRoom.currentTurn;
    const currentPlayer = gameRoom.players[currentTurnUID];
    let updates: any = {};

    switch (mysteryBoxEffect.type) {
        case 'bonus':
        case 'penalty':
            updates[`players.${currentTurnUID}.score`] = increment(mysteryBoxEffect.value || 0);
            break;
        case 'double':
            updates[`players.${currentTurnUID}.score`] = currentPlayer.score * 2;
            break;
        case 'half':
            updates[`players.${currentTurnUID}.score`] = Math.floor(currentPlayer.score / 2);
            break;
        case 'swap':
            if (!playerForSwap) {
                toast({ variant: 'destructive', title: '오류', description: '점수를 바꿀 플레이어를 선택해주세요.'});
                setIsSubmitting(false);
                return;
            }
            const targetPlayer = gameRoom.players[playerForSwap];
            updates[`players.${currentTurnUID}.score`] = targetPlayer.score;
            updates[`players.${playerForSwap}.score`] = currentPlayer.score;
            break;
    }
    
    try {
        await updateDoc(roomRef, updates);
        await handleNextTurn();
    } catch (error) {
        console.error("Error applying mystery effect:", error);
        toast({ variant: 'destructive', title: '오류', description: '미스터리 효과 적용 중 오류 발생'});
    } finally {
        setIsSubmitting(false);
        handleCloseDialogs();
    }
  };


  const currentTurnPlayer = players.find(p => p.uid === gameRoom?.currentTurn);
  
  if (isLoading || loadingUser || !gameRoom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 정보를 불러오는 중...</p>
      </div>
    );
  }

  const isClickDisabled = (block: GameBlock) => {
    const isRemoteAndNotMyTurn = gameRoom.joinType === 'remote' && !isMyTurn;
    return isRemoteAndNotMyTurn || block.isOpened || block.isFlipping;
  };

  return (
    <>
    <div className="container mx-auto flex h-full max-h-[calc(100vh-4rem)] flex-col lg:flex-row gap-6">
      {/* Game Board */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-blue-100/50 dark:bg-blue-900/20 rounded-xl shadow-inner">
        <Card className="w-full max-w-4xl p-4 sm:p-6 bg-background/70 backdrop-blur-sm">
           <div className="text-center mb-6">
                <h2 className="text-2xl font-bold font-headline">
                    {gameRoom.joinType === 'local' ? (
                        <span>박스를 선택하여 문제를 풀어보세요!</span>
                    ) : isMyTurn ? (
                        <span className="text-primary">내 차례입니다!</span>
                    ) : (
                        <span><span className="text-primary">{currentTurnPlayer?.nickname || ''}</span>님의 차례입니다!</span>
                    )}
                </h2>
                <p className="text-muted-foreground">점수를 얻을 질문을 선택하세요.</p>
            </div>
          <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-4">
            {blocks.map((block, index) => (
               <div key={block.id} className="perspective-1000" onClick={() => handleBlockClick(block)}>
                    <div className={cn(
                        "relative aspect-square w-full transform-style-3d transition-transform duration-700",
                        block.isFlipping ? "rotate-y-180" : "",
                        isClickDisabled(block) ? 'cursor-not-allowed' : 'cursor-pointer'
                    )}>
                        {/* Front of the card */}
                        <div className={cn(
                            "absolute inset-0 backface-hidden flex flex-col items-center justify-center rounded-lg shadow-md transition-all duration-300",
                            "bg-yellow-400 border-b-8 border-yellow-600",
                            "hover:scale-105 hover:shadow-xl",
                            block.isOpened ? 'opacity-30 bg-gray-300 border-gray-400' : ''
                        )}>
                            <span className="text-3xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                                {block.type === 'question' ? '?' : '!'}
                            </span>
                             <span className="absolute bottom-1 right-2 text-sm font-bold text-white/70">{index + 1}</span>
                        </div>
                        
                        {/* Back of the card */}
                        <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center bg-secondary rounded-lg">
                           {block.type === 'question' ? (
                             <div className="flex flex-col items-center text-primary font-bold text-center p-1">
                                <Star className="w-1/2 h-1/2 text-yellow-400 fill-yellow-400" />
                                <span className="text-sm">{block.question?.points === -1 ? '랜덤' : `${block.question?.points}점`}</span>
                             </div>
                           ) : (
                             <div className="flex flex-col items-center text-accent font-bold text-center p-1">
                                <Gift className="w-1/2 h-1/2" />
                                <span className="text-sm">미스터리</span>
                             </div>
                           )}
                        </div>
                    </div>
               </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Scoreboard & Info */}
      <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0">
        <Card className="h-full flex flex-col">
            <div className="p-4 border-b">
                <h2 className="font-headline text-xl font-bold text-center">스코어보드</h2>
            </div>
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {players.map((player, index) => (
                    <div key={player.uid} className={cn(
                        "p-3 rounded-lg border-2 transition-all", 
                        player.uid === gameRoom?.currentTurn ? 'border-primary shadow-lg bg-primary/10' : 'border-transparent'
                    )}>
                       <div className="flex items-center gap-3">
                            <div className="font-bold text-lg w-6 text-center text-muted-foreground">
                                {index === 0 ? <Crown className="w-5 h-5 mx-auto text-yellow-500 fill-yellow-400" /> : index + 1}
                            </div>
                            <Image src={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageUrl || ''} alt={player.nickname} width={40} height={40} className="rounded-full" data-ai-hint={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageHint} />
                            <div className="flex-grow">
                                <p className="font-semibold">{player.nickname}</p>
                                <Progress value={(player.score / 500) * 100} className="h-2 mt-1" />
                            </div>
                            <div className="font-bold text-primary text-lg w-12 text-right">{player.score}</div>
                       </div>
                    </div>
                ))}
            </div>
            {gameRoom?.mysteryBoxEnabled && (
                <div className="p-4 border-t bg-secondary/30">
                    <h3 className="font-headline font-semibold mb-2 text-center">미스터리 박스 효과</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <Badge variant="outline" className="justify-center py-1"><Star className="w-3 h-3 mr-1.5"/> 점수 2배</Badge>
                        <Badge variant="outline" className="justify-center py-1"><Shield className="w-3 h-3 mr-1.5"/> 감점 방어</Badge>
                        <Badge variant="outline" className="justify-center py-1"><Swords className="w-3 h-3 mr-1.5"/> 점수 뺏기</Badge>
                        <Badge variant="outline" className="justify-center py-1"><Zap className="w-3 h-3 mr-1.5"/> 한 턴 쉬기</Badge>
                        <Badge variant="outline" className="justify-center py-1 col-span-2"><HelpCircle className="w-3 h-3 mr-1.5"/> ???</Badge>
                    </div>
                </div>
            )}
        </Card>
      </aside>
    </div>

    {/* Question Popup */}
    <Dialog open={!!currentQuestion} onOpenChange={(isOpen) => !isOpen && handleCloseDialogs()}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                 <div className="flex justify-between items-center">
                    <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                        질문
                        <span className="flex items-center gap-1 font-semibold text-primary text-base">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                            {currentPoints}점
                        </span>
                    </DialogTitle>
                    {currentQuestion?.hint && !showHint && (
                        <Button variant="outline" size="sm" onClick={handleShowHint} disabled={isSubmitting}>
                            <Lightbulb className="w-4 h-4 mr-2" />
                            힌트 보기 (점수 절반)
                        </Button>
                    )}
                 </div>
                 {currentQuestion?.hint && showHint && (
                    <DialogDescription>힌트: {currentQuestion.hint}</DialogDescription>
                 )}
            </DialogHeader>
            <div className="py-4 space-y-6">
                <p className="text-lg font-medium">{currentQuestion?.question}</p>

                <div>
                    {currentQuestion?.type === 'subjective' && (
                        <Input 
                            placeholder="정답을 입력하세요" 
                            value={userAnswer}
                            onChange={(e) => setUserAnswer(e.target.value)}
                            disabled={isSubmitting}
                        />
                    )}
                    {currentQuestion?.type === 'multipleChoice' && currentQuestion.options && (
                        <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="space-y-2" disabled={isSubmitting}>
                            {currentQuestion.options.map((option, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <RadioGroupItem value={option} id={`option-${index}`} />
                                    <Label htmlFor={`option-${index}`} className="flex-1 p-3 rounded-md border hover:border-primary cursor-pointer">{option}</Label>
                                </div>
                            ))}
                        </RadioGroup>
                    )}
                    {currentQuestion?.type === 'ox' && (
                        <RadioGroup value={userAnswer} onValueChange={setUserAnswer} className="grid grid-cols-2 gap-4" disabled={isSubmitting}>
                            <Label htmlFor="option-o" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'O' && 'border-primary bg-primary/10')}>
                                <RadioGroupItem value="O" id="option-o" className="sr-only"/>
                                O
                            </Label>
                            <Label htmlFor="option-x" className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", userAnswer === 'X' && 'border-primary bg-primary/10')}>
                                <RadioGroupItem value="X" id="option-x" className="sr-only"/>
                                X
                            </Label>
                        </RadioGroup>
                    )}
                </div>
            </div>
            
            <Button className="w-full" onClick={handleSubmitAnswer} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "정답 제출"}
            </Button>
        </DialogContent>
    </Dialog>

    {/* Mystery Box Popup */}
    <Dialog open={showMysteryBoxPopup} onOpenChange={(isOpen) => !isOpen && handleCloseDialogs()}>
        <DialogContent className="max-w-md text-center">
            <DialogHeader>
                 <div className="flex flex-col items-center gap-4">
                    {mysteryBoxEffect?.icon}
                    <DialogTitle className="font-headline text-3xl">{mysteryBoxEffect?.title}</DialogTitle>
                    <DialogDescription className="text-base">{mysteryBoxEffect?.description}</DialogDescription>
                 </div>
            </DialogHeader>
            <div className="py-4">
                {mysteryBoxEffect?.type === 'swap' && (
                  <div className="text-left space-y-2">
                    <Label className="font-semibold">바꿀 플레이어 선택:</Label>
                     <RadioGroup value={playerForSwap || ''} onValueChange={setPlayerForSwap} className="space-y-2" disabled={isSubmitting}>
                        {players.filter(p => p.uid !== gameRoom?.currentTurn).map((player) => (
                           <Label key={player.uid} htmlFor={`swap-${player.uid}`} className="flex items-center gap-3 p-3 rounded-md border hover:border-primary cursor-pointer">
                                <RadioGroupItem value={player.uid} id={`swap-${player.uid}`} />
                                <Image src={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageUrl || ''} alt={player.nickname} width={32} height={32} className="rounded-full" data-ai-hint={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageHint}/>
                                <span className="font-semibold">{player.nickname}</span>
                                <span className="ml-auto text-primary font-bold">{player.score}점</span>
                           </Label>
                        ))}
                    </RadioGroup>
                  </div>
                )}
            </div>
            <Button className="w-full" onClick={handleMysteryEffect} disabled={isSubmitting || (mysteryBoxEffect?.type === 'swap' && !playerForSwap)}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "효과 적용"}
            </Button>
        </DialogContent>
    </Dialog>
    </>
  );
}
