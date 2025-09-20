'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, Question } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Crown, HelpCircle, Loader2, Shield, Star, Swords, Zap } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';


interface GameBlock {
  id: number;
  type: 'question' | 'mystery';
  question?: Question;
  isFlipping: boolean;
  isOpened: boolean;
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


export default function GamePage({ params }: { params: { id: string } }) {
  const { id: gameRoomId } = useParams();
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  const { toast } = useToast();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [blocks, setBlocks] = useState<GameBlock[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);

  // Fetch GameRoom and GameSet data
  useEffect(() => {
    if (!gameRoomId) return;

    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
        setGameRoom(roomData);
        setPlayers(Object.values(roomData.players).sort((a, b) => b.score - a.score));

        if (user) {
            setIsMyTurn(roomData.currentTurn === user.uid);
        }

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
  }, [gameRoomId, router, toast, user, gameSet]);


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
        const mysteryCount = Math.floor(gameSet.questions.length * 0.3);
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
  
  const handleBlockClick = (block: GameBlock) => {
    if (!isMyTurn || block.isOpened || block.isFlipping) return;

    // 1. Start flipping animation
    setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isFlipping: true } : b));
    
    // 2. After animation, show popup and mark as opened
    setTimeout(() => {
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isFlipping: false, isOpened: true } : b));

      if (block.type === 'question') {
        setCurrentQuestion(block.question || null);
        
        // Update Firestore state
        const roomRef = doc(db, 'game-rooms', gameRoomId as string);
        updateDoc(roomRef, {
            [`gameState.${block.id}`]: 'answered'
        });
      } else {
        // Handle mystery box logic
        toast({ title: "미스터리 박스!", description: "놀라운 효과가 발동됩니다!" });
        // TODO: Implement next turn logic after mystery box
      }
    }, 800); // Animation duration
  };

  const currentTurnPlayer = players.find(p => p.uid === gameRoom?.currentTurn);
  
  if (isLoading || loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto flex h-full max-h-[calc(100vh-4rem)] flex-col lg:flex-row gap-6">
      {/* Game Board */}
      <div className="flex-grow flex flex-col items-center justify-center p-6 bg-blue-100/50 dark:bg-blue-900/20 rounded-xl shadow-inner">
        <Card className="w-full max-w-4xl p-4 sm:p-6 bg-background/70 backdrop-blur-sm">
           <div className="text-center mb-6">
                <h2 className="text-2xl font-bold font-headline">
                    {isMyTurn ? (
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
                        !isMyTurn || block.isOpened ? 'cursor-not-allowed' : 'cursor-pointer'
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
                                <HelpCircle className="w-1/2 h-1/2" />
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
                                <Progress value={(player.score / 50) * 100} className="h-2 mt-1" />
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
    <Dialog open={!!currentQuestion} onOpenChange={(isOpen) => !isOpen && setCurrentQuestion(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                 <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                    질문
                    <span className="flex items-center gap-1 font-semibold text-primary text-base">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                        {currentQuestion?.points === -1 ? '랜덤' : `${currentQuestion?.points}점`}
                    </span>
                 </DialogTitle>
                 {currentQuestion?.hint && (
                    <DialogDescription>힌트: {currentQuestion.hint}</DialogDescription>
                 )}
            </DialogHeader>
            <div className="py-4">
                <p className="text-lg font-medium">{currentQuestion?.question}</p>
            </div>
            {/* TODO: Add answer input/options and submit button */}
            <div className="text-center p-8 border-2 border-dashed rounded-md text-muted-foreground">
                <p>답변 입력 영역</p>
            </div>
            <Button className="w-full">정답 제출</Button>
        </DialogContent>
    </Dialog>
    </>
  );
}
