

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, Question, MysteryEffectType, AnswerLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Crown, HelpCircle, Loader2, Star, Gift, TrendingDown, Repeat, Bomb, ChevronsRight, Lightbulb } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { updateScores } from '@/app/actions';

interface GameBlock {
  id: number;
  type: 'question' | 'mystery';
  question?: Question & { id: number };
}

interface MysteryEffect {
    type: MysteryEffectType;
    title: string;
    description: string;
    icon: React.ReactNode;
    value?: number;
}

const allMysteryEffects: {type: MysteryEffectType, title: string, description: string}[] = [
    { type: 'bonus', title: '점수 보너스', description: '10-50점의 보너스 점수를 획득합니다.'},
    { type: 'double', title: '점수 2배', description: '현재까지 누적된 모든 점수가 2배가 됩니다.'},
    { type: 'penalty', title: '점수 감점', description: '10-50점의 점수가 감점됩니다.'},
    { type: 'half', title: '점수 반감', description: '현재까지 누적된 모든 점수가 절반으로 줄어듭니다.'},
    { type: 'swap', title: '점수 바꾸기', description: '다른 플레이어와 점수를 바꿀 수 있습니다.'},
];

// Function to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const calculateScoresFromLogs = (gameRoom: GameRoom | null): Player[] => {
    if (!gameRoom || !gameRoom.players) return [];

    const scores: Record<string, number> = {};
    for (const uid in gameRoom.players) {
        scores[uid] = 0;
    }

    gameRoom.answerLogs?.forEach(log => {
        if (log.userId && log.pointsAwarded) {
             scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
        }
    });

    const playerList = Object.values(gameRoom.players);
        
    const updatedPlayers = playerList.map(p => ({
        ...p,
        score: scores[p.uid] || 0,
    }));

    return updatedPlayers.sort((a, b) => b.score - a.score);
}


export default function GamePage() {
  const { id: gameRoomId } = useParams();
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [blocks, setBlocks] = useState<GameBlock[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [currentQuestionInfo, setCurrentQuestionInfo] = useState<{question: Question & { id: number }, blockId: number} | null>(null);
  const [currentPoints, setCurrentPoints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  
  const [isMyTurn, setIsMyTurn] = useState(true);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showMysteryBoxPopup, setShowMysteryBoxPopup] = useState(false);
  const [mysteryBoxEffect, setMysteryBoxEffect] = useState<MysteryEffect | null>(null);
  const [playerForSwap, setPlayerForSwap] = useState<string | null>(null);
  
  const [showMysterySettings, setShowMysterySettings] = useState(false);
  const [selectedEffects, setSelectedEffects] = useState<MysteryEffectType[]>(allMysteryEffects.map(e => e.type));
  const [showGameOverPopup, setShowGameOverPopup] = useState(false);
  const [finalScores, setFinalScores] = useState<Player[]>([]);
  const [isGameFinished, setIsGameFinished] = useState(false);

  const finishGame = useCallback(async (room: GameRoom) => {
    if (isGameFinished || !gameSet) return;
    setIsGameFinished(true); // Prevent multiple executions
  
    try {
      const finalPlayers = calculateScoresFromLogs(room);
      setFinalScores(finalPlayers);
      setShowGameOverPopup(true);
  
      // Call server action to update scores and XP, and log answers
      await updateScores({
        players: finalPlayers,
        answerLogs: room.answerLogs || [],
      });
  
    } catch (error) {
      console.error("Error during finishGame:", error);
       toast({
          variant: "destructive",
          title: "오류",
          description: "게임 결과 처리 중 심각한 오류가 발생했습니다.",
        });
    }
  }, [gameSet, isGameFinished, toast]);

  // Fetch GameRoom and GameSet data
  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string') return;

    const roomRef = doc(db, 'game-rooms', gameRoomId);

    const handleSnapshot = async (docSnap: any) => {
        if (docSnap.exists()) {
            const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
            setGameRoom(roomData);

            if (roomData.status === 'playing' && roomData.mysteryBoxEnabled && !roomData.isMysterySettingDone && roomData.hostId === user?.uid) {
                setShowMysterySettings(true);
            }
             
            if (roomData.status === 'finished') {
                finishGame(roomData);
            }

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
    }
    
    const unsubscribe = onSnapshot(roomRef, handleSnapshot, (error) => {
        console.error("Error fetching game room: ", error);
        toast({ variant: 'destructive', title: '오류', description: '게임방 정보를 불러오는 중 오류가 발생했습니다.' });
        setIsLoading(false);
        router.push('/dashboard');
    });

    return () => {
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameRoomId, router, toast, user]);
  
  // Initialize players and turn status from local gameRoom state
  useEffect(() => {
    if (!gameRoom || loadingUser) return;

    const calculatedPlayers = calculateScoresFromLogs(gameRoom);
    if (JSON.stringify(calculatedPlayers) !== JSON.stringify(players)) {
        setPlayers(calculatedPlayers);
    }
    
    if (gameRoom.joinType === 'remote') {
        setIsMyTurn(gameRoom.currentTurn === user?.uid);
    } else {
        setIsMyTurn(true);
    }
  }, [gameRoom, user, loadingUser, players]);


  // Initialize game blocks once
  useEffect(() => {
    if (!gameSet || !gameRoom || blocks.length > 0) return;

    const questionItems: GameBlock[] = gameSet.questions.map((q, i) => ({
        id: i,
        type: 'question',
        question: {...q, id: i},
    }));

    let mysteryItems: GameBlock[] = [];
    if(gameRoom.mysteryBoxEnabled) {
        const mysteryCount = Math.round(gameSet.questions.length * 0.3);
        mysteryItems = Array.from({ length: mysteryCount }, (_, i) => ({
            id: gameSet.questions.length + i,
            type: 'mystery',
        }));
    }
    
    const allItems = [...questionItems, ...mysteryItems];
    const shuffledBlocks = shuffleArray(allItems);
    
    setBlocks(shuffledBlocks);
  }, [gameSet, gameRoom, blocks.length]);

  
  const handleBlockClick = (block: GameBlock) => {
    if (isClickDisabled(block) || !gameRoom || typeof gameRoomId !== 'string') return;
    
    const newGameState: GameRoom['gameState'] = { ...gameRoom.gameState, [String(block.id)]: 'flipping' };
    
    const roomRef = doc(db, 'game-rooms', gameRoomId);
    updateDoc(roomRef, { gameState: newGameState });

    setTimeout(() => {
      if (block.type === 'question' && block.question) {
        setCurrentQuestionInfo({question: block.question, blockId: block.id});
        
        let points = block.question.points;
        if (points === -1) { 
            points = (Math.floor(Math.random() * 5) + 1) * 10;
        }
        setCurrentPoints(points);
        setShowHint(false);
        setUserAnswer('');
        
      } else { // Mystery Box
        handleMysteryBoxOpen(block.id);
      }
    }, 800);
  };
  
  const handleMysteryBoxOpen = (blockId: number) => {
      if (!gameRoom || typeof gameRoomId !== 'string') return;

      const effects = gameRoom?.enabledMysteryEffects || allMysteryEffects.map(e => e.type);
      if (effects.length === 0) {
          toast({ title: '이런!', description: '아무 일도 일어나지 않았습니다. 설정된 미스터리 효과가 없습니다.' });
          
          const newGameState: GameRoom['gameState'] = { ...gameRoom.gameState, [String(blockId)]: 'answered' };
          const roomRef = doc(db, 'game-rooms', gameRoomId);
          
          const nextTurnUID = getNextTurnUID();
          const allAnswered = Object.keys(newGameState).length === blocks.length;

          updateDoc(roomRef, { 
              gameState: newGameState,
              currentTurn: nextTurnUID,
              ...(allAnswered && { status: 'finished' })
          });
          return;
      }
      
      const randomEffectType = effects[Math.floor(Math.random() * effects.length)];
      const originalEffect = allMysteryEffects.find(e => e.type === randomEffectType);
      if (!originalEffect) return;

      let effectDetails: MysteryEffect;
      const randomPoints = (Math.floor(Math.random() * 5) + 1) * 10;

      switch (randomEffectType) {
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

  const handleShowHint = () => {
    setShowHint(true);
    setCurrentPoints(prev => Math.floor(prev / 2));
  };

  const getNextTurnUID = (): string => {
    if (!gameRoom) return '';
    const playerUIDs = gameRoom.playerUIDs || Object.keys(gameRoom.players);
    if (playerUIDs.length === 0) return '';
    if (gameRoom.joinType === 'remote') return gameRoom.currentTurn; // Remote game turn is handled by host implicitly

    const currentTurnIndex = playerUIDs.indexOf(gameRoom.currentTurn);
    const nextTurnIndex = (currentTurnIndex + 1) % playerUIDs.length;
    return playerUIDs[nextTurnIndex];
  }


  const handleCloseDialogs = () => {
    setCurrentQuestionInfo(null);
    setShowMysteryBoxPopup(false);
    setMysteryBoxEffect(null);
    setPlayerForSwap(null);
  }

  const handleSubmitAnswer = async () => {
    if (!currentQuestionInfo || !gameRoom || !userAnswer || !gameSet || typeof gameRoomId !== 'string') {
      toast({ variant: 'destructive', title: '오류', description: '답변을 선택하거나 입력해주세요.'});
      return;
    }
    const currentQuestion = currentQuestionInfo.question;

    setIsSubmitting(true);

    const isCorrect = (currentQuestion.type === 'subjective' && userAnswer.trim().toLowerCase() === currentQuestion.answer?.trim().toLowerCase())
      || (currentQuestion.type !== 'subjective' && userAnswer === currentQuestion.correctAnswer);

    const pointsToAward = isCorrect ? currentPoints : 0;
    const currentTurnUID = gameRoom.currentTurn;

    const answerLog: AnswerLog = {
        userId: currentTurnUID,
        gameSetId: gameSet.id,
        gameSetTitle: gameSet.title,
        question: currentQuestion,
        userAnswer: userAnswer,
        isCorrect: isCorrect,
        pointsAwarded: pointsToAward,
        timestamp: Timestamp.now(),
    };
    
    try {
        const roomRef = doc(db, 'game-rooms', gameRoomId);
        
        const newAnswerLogs = [...(gameRoom.answerLogs || []), answerLog];
        const newGameState: GameRoom['gameState'] = {...gameRoom.gameState, [String(currentQuestionInfo.blockId)]: 'answered'};
        const allAnswered = Object.keys(newGameState).length === blocks.length;
        const nextTurnUID = getNextTurnUID();

        await updateDoc(roomRef, {
            answerLogs: newAnswerLogs,
            gameState: newGameState,
            currentTurn: nextTurnUID,
            ...(allAnswered && { status: 'finished' })
        });

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
        
    } catch(error) {
         toast({variant: 'destructive', title: '오류', description: '답변 제출 중 오류가 발생했습니다.'});
    } finally {
        setIsSubmitting(false);
        handleCloseDialogs();
    }
  };

  const handleMysteryEffect = async () => {
    if (!mysteryBoxEffect || !gameRoom || typeof gameRoomId !== 'string' || !gameSet) return;
  
    setIsSubmitting(true);
    
    const currentTurnUID = gameRoom.currentTurn;
    const currentFlippingBlock = Object.entries(gameRoom.gameState).find(([_, state]) => state === 'flipping');
    const blockId = currentFlippingBlock ? currentFlippingBlock[0] : undefined;

    if (blockId === undefined) {
      setIsSubmitting(false);
      handleCloseDialogs();
      return;
    }
  
    let newLogEntry: Partial<AnswerLog> = {
      userId: currentTurnUID,
      gameSetId: gameRoom.gameSetId,
      gameSetTitle: gameSet?.title || "미스터리 박스",
      question: { id: Date.now(), question: mysteryBoxEffect.title, type: 'subjective', points: 0 },
      isCorrect: true, 
      timestamp: Timestamp.now(),
    };
  
    try {
        const logsToPush: AnswerLog[] = [];
        let pointsChange = 0;
        
        const currentPlayersState = calculateScoresFromLogs(gameRoom);

        switch (mysteryBoxEffect.type) {
            case 'bonus':
            case 'penalty':
                pointsChange = mysteryBoxEffect.value || 0;
                logsToPush.push({ ...newLogEntry, pointsAwarded: pointsChange, userAnswer: 'effect' } as AnswerLog);
                break;
            case 'double':
                pointsChange = currentPlayersState.find(p => p.uid === currentTurnUID)?.score || 0;
                logsToPush.push({ ...newLogEntry, pointsAwarded: pointsChange, userAnswer: 'effect' } as AnswerLog);
                break;
            case 'half':
                pointsChange = -Math.floor((currentPlayersState.find(p => p.uid === currentTurnUID)?.score || 0) / 2);
                logsToPush.push({ ...newLogEntry, pointsAwarded: pointsChange, userAnswer: 'effect' } as AnswerLog);
                break;
            case 'swap':
                 if (!playerForSwap) {
                  toast({ variant: 'destructive', title: '오류', description: '점수를 바꿀 플레이어를 선택해주세요.'});
                  setIsSubmitting(false);
                  return;
                }
                const currentPlayerScore = currentPlayersState.find(p => p.uid === currentTurnUID)?.score || 0;
                const targetPlayerScore = currentPlayersState.find(p => p.uid === playerForSwap)?.score || 0;
                
                const pointsDiffForCurrent = targetPlayerScore - currentPlayerScore;
                const pointsDiffForTarget = currentPlayerScore - targetPlayerScore;
        
                logsToPush.push({ ...newLogEntry, userId: currentTurnUID, pointsAwarded: pointsDiffForCurrent, userAnswer: 'effect', question: {...newLogEntry.question!, id: Date.now() + 1}} as AnswerLog);
                logsToPush.push({ ...newLogEntry, userId: playerForSwap, pointsAwarded: pointsDiffForTarget, userAnswer: 'effect', question: {...newLogEntry.question!, id: Date.now() + 2} } as AnswerLog);
                break;
        }

        const roomRef = doc(db, 'game-rooms', gameRoomId);
        
        const newAnswerLogs = [...(gameRoom.answerLogs || []), ...logsToPush];
        const newGameState: GameRoom['gameState'] = {...gameRoom.gameState, [blockId]: 'answered'};
        const allAnswered = Object.keys(newGameState).length === blocks.length;
        const nextTurnUID = getNextTurnUID();

        await updateDoc(roomRef, {
            answerLogs: newAnswerLogs,
            gameState: newGameState,
            currentTurn: nextTurnUID,
            ...(allAnswered && { status: 'finished' })
        });

    } catch (error: any) {
      console.error("Error applying mystery effect:", error);
      toast({ variant: 'destructive', title: '오류', description: '미스터리 효과 적용 중 오류가 발생했습니다.'});
    } finally {
      setIsSubmitting(false);
      handleCloseDialogs();
    }
  };

  const handleSaveMysterySettings = async () => {
      if (!gameRoomId || typeof gameRoomId !== 'string' || !gameRoom) return;
      setIsSubmitting(true);
      try {
        const roomRef = doc(db, 'game-rooms', gameRoomId);
        await updateDoc(roomRef, {
            enabledMysteryEffects: selectedEffects,
            isMysterySettingDone: true
        });

        setShowMysterySettings(false);
        toast({ title: '성공', description: '미스터리 박스 설정이 저장되었습니다.'});
      } catch (error) {
          console.error("Error saving mystery settings:", error);
          toast({ variant: 'destructive', title: '오류', description: '설정 저장 중 오류가 발생했습니다.'});
      } finally {
          setIsSubmitting(false);
      }
  }


  const currentTurnPlayer = players.find(p => p.uid === gameRoom?.currentTurn);
  const currentQuestion = currentQuestionInfo?.question;
  
  const isClickDisabled = (block: GameBlock) => {
    if (!gameRoom || showGameOverPopup) return true;
    
    const blockState = gameRoom.gameState[String(block.id)];
    if (blockState === 'answered' || blockState === 'flipping') {
        return true;
    }
    
    // For local games, it's always "your turn".
    if (gameRoom.joinType === 'local') {
        return !!currentQuestionInfo || !!showMysteryBoxPopup;
    }
    
    // For remote games, check turn.
    return !isMyTurn || !!currentQuestionInfo || !!showMysteryBoxPopup;
  };
  
  if (isLoading || loadingUser || !gameRoom || !gameSet || blocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 정보를 불러오는 중...</p>
      </div>
    );
  }

  const scoreboardPlayers = players;

  const winner = finalScores.length > 0 ? finalScores[0] : null;

  return (
    <>
      <div className="container mx-auto flex h-full max-h-[calc(100vh-4rem)] flex-col lg:flex-row gap-6 p-4">
        {/* Game Board */}
        <div className="flex-grow flex flex-col items-center justify-center p-6 bg-blue-100/50 dark:bg-blue-900/20 rounded-xl shadow-inner">
          <Card className="w-full max-w-4xl p-4 sm:p-6 bg-background/70 backdrop-blur-sm">
            <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold font-headline">
                      {gameRoom.joinType === 'local' ? (
                          <span><span className="text-primary">{currentTurnPlayer?.nickname || ''}</span>님, 박스를 선택하여 문제를 풀어보세요!</span>
                      ) : isMyTurn ? (
                          <span className="text-primary">내 차례입니다!</span>
                      ) : (
                          <span><span className="text-primary">{currentTurnPlayer?.nickname || ''}</span>님의 차례입니다!</span>
                      )}
                  </h2>
                  <p className="text-muted-foreground">점수를 얻을 질문을 선택하세요.</p>
              </div>
            <div className="grid grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-2 sm:gap-4">
              {blocks.map((block, index) => {
                const blockState = gameRoom.gameState[String(block.id)];
                const isOpened = blockState === 'answered';
                const isFlipping = blockState === 'flipping';

                return (
                <div key={block.id} className="perspective-1000" onClick={() => handleBlockClick(block)}>
                      <div className={cn(
                          "relative aspect-square w-full transform-style-3d transition-transform duration-700",
                          isFlipping || isOpened ? "rotate-y-180" : "",
                          isClickDisabled(block) ? 'cursor-not-allowed' : 'cursor-pointer'
                      )}>
                          {/* Front of the card */}
                          <div className={cn(
                              "absolute inset-0 backface-hidden flex flex-col items-center justify-center rounded-lg shadow-md transition-all duration-300",
                              "bg-yellow-400 border-b-8 border-yellow-600",
                              !isClickDisabled(block) && "hover:scale-105 hover:shadow-xl",
                              isOpened ? 'opacity-30 bg-gray-300 border-gray-400' : ''
                          )}>
                              <span className="text-4xl font-bold text-white" style={{ textShadow: '2px 2px 0px #b45309, 4px 4px 0px #854d0e' }}>
                                  {index + 1}
                              </span>
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
              )})}
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
                  {scoreboardPlayers.map((player, index) => (
                      <div key={player.uid} className={cn(
                          "p-3 rounded-lg border-2 transition-all", 
                          player.uid === gameRoom?.currentTurn ? 'border-primary shadow-lg bg-primary/10' : 'border-transparent'
                      )}>
                        <div className="flex items-center gap-3">
                              <div className="font-bold text-lg w-6 text-center text-muted-foreground">
                                  {index === 0 && player.score > 0 ? <Crown className="w-5 h-5 mx-auto text-yellow-500 fill-yellow-400" /> : index + 1}
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
          </Card>
        </aside>
      </div>

      {/* Mystery Box Settings Popup */}
       <Dialog open={showMysterySettings} onOpenChange={setShowMysterySettings}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle className="font-headline text-2xl">미스터리 박스 효과 설정</DialogTitle>
                  <DialogDescription>게임에 적용할 미스터리 박스 효과를 선택하세요. (호스트만 설정 가능)</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  {allMysteryEffects.map((effect) => (
                      <div key={effect.type} className="flex items-center space-x-2">
                          <Checkbox
                              id={effect.type}
                              checked={selectedEffects.includes(effect.type)}
                              onCheckedChange={(checked) => {
                                  return checked
                                      ? setSelectedEffects([...selectedEffects, effect.type])
                                      : setSelectedEffects(selectedEffects.filter(e => e !== effect.type));
                              }}
                          />
                          <Label htmlFor={effect.type} className="flex flex-col gap-0.5">
                              <span>{effect.title}</span>
                              <span className="text-xs text-muted-foreground">{effect.description}</span>
                          </Label>
                      </div>
                  ))}
              </div>
              <Button onClick={handleSaveMysterySettings} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "설정 완료하고 게임 시작"}
              </Button>
          </DialogContent>
      </Dialog>

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
                  {currentQuestion?.imageUrl && (
                      <div className="relative aspect-video w-full">
                          <Image src={encodeURI(currentQuestion.imageUrl)} alt="Question Image" fill className="rounded-md object-contain" />
                      </div>
                  )}
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

      {/* Game Over Popup */}
      <Dialog open={showGameOverPopup}>
          <DialogContent className="max-w-md text-center" aria-describedby="game-over-description">
              <DialogHeader>
                  <div className="flex flex-col items-center gap-2">
                      <Crown className="w-20 h-20 text-yellow-400 fill-yellow-300" />
                      <DialogTitle className="font-headline text-3xl">게임 종료!</DialogTitle>
                      {winner && (
                          <DialogDescription id="game-over-description" className="text-base">
                            우승자는 <span className="font-bold text-primary">{winner.nickname}</span> 님 입니다!
                          </DialogDescription>
                      )}
                  </div>
              </DialogHeader>
              <div className="py-4">
                  <h3 className="font-semibold mb-3">최종 점수</h3>
                  <div className="space-y-2">
                      {finalScores.map(p => (
                          <div key={p.uid} className="flex justify-between items-center p-2 rounded-md bg-secondary/50">
                              <span className="font-semibold">{p.nickname}</span>
                              <span className="font-bold text-primary">{p.score}점</span>
                          </div>
                      ))}
                  </div>
              </div>
              <DialogFooter className="sm:justify-center">
                  <Button asChild>
                      <Link href="/dashboard">돌아가기</Link>                 
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </>
  );
}
