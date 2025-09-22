'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { db, auth } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, JoinType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { Smartphone, Lock, Users, Loader2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';


function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


function NewGameRoomPageContents() {
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameSetId = searchParams.get('gameSetId');
  const initialJoinType = searchParams.get('joinType') as JoinType | null;
  const { toast } = useToast();

  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [hasPlayedToday, setHasPlayedToday] = useState(false);
  
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [mysteryBoxEnabled, setMysteryBoxEnabled] = useState(true);
  const [joinType, setJoinType] = useState<JoinType>(initialJoinType || 'local');

  useEffect(() => {
    if (!gameSetId) {
      toast({ variant: 'destructive', title: '오류', description: '게임 세트 ID가 필요합니다.' });
      router.push('/dashboard');
      return;
    }
    
    if (loadingUser) return;

    const fetchGameData = async () => {
      setIsLoading(true);
      
      const docRef = doc(db, 'game-sets', gameSetId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setGameSet({ id: docSnap.id, ...docSnap.data() } as GameSet);
      } else {
        toast({ variant: 'destructive', title: '오류', description: '게임 세트를 찾을 수 없습니다.' });
        router.push('/dashboard');
        setIsLoading(false);
        return;
      }
      
      if (user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startOfToday = Timestamp.fromDate(today);

        const correctQuery = query(
          collection(db, 'users', user.uid, 'correct-answers'),
          where('gameSetId', '==', gameSetId),
          where('timestamp', '>=', startOfToday)
        );
        const incorrectQuery = query(
          collection(db, 'users', user.uid, 'incorrect-answers'),
          where('gameSetId', '==', gameSetId),
          where('timestamp', '>=', startOfToday)
        );

        const [correctSnapshot, incorrectSnapshot] = await Promise.all([
            getDocs(correctQuery),
            getDocs(incorrectQuery),
        ]);

        if (!correctSnapshot.empty || !incorrectSnapshot.empty) {
            setHasPlayedToday(true);
        }
      }

      setIsLoading(false);
    };

    fetchGameData();
  }, [gameSetId, router, toast, user, loadingUser]);

  const handleCreateRoom = async () => {
    if (!user || !gameSet) return;
    
    setIsCreating(true);

    try {
      let newRoomId;
      let roomExists = true;
      while (roomExists) {
        newRoomId = generateRoomId();
        const roomRef = doc(db, 'game-rooms', newRoomId);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          roomExists = false;
        }
      }

      if (!newRoomId) {
        throw new Error('Failed to generate a unique room ID.');
      }

      const hostPlayer: Player = {
        uid: user.uid,
        nickname: user.displayName || '호스트',
        score: 0,
        avatarId: `player-avatar-${Math.floor(Math.random() * 4) + 1}`,
        isHost: true,
      };
      
      const newRoom: Omit<GameRoom, 'id' | 'createdAt'> = {
        gameSetId: gameSet.id,
        status: 'waiting',
        hostId: user.uid,
        currentTurn: user.uid,
        players: {
            [user.uid]: hostPlayer
        },
        gameState: {},
        mysteryBoxEnabled: mysteryBoxEnabled,
        isMysterySettingDone: false,
        joinType: joinType,
        ...(usePassword && password && { password }),
      };

      await setDoc(doc(db, "game-rooms", newRoomId), {
          ...newRoom,
          id: newRoomId,
          createdAt: serverTimestamp(),
      });
      
      toast({ title: '성공', description: '새로운 게임방을 만들었습니다!' });
      router.push(`/game/${newRoomId}/lobby`);

    } catch (error) {
        console.error("Error creating game room:", error);
        toast({ variant: 'destructive', title: '오류', description: '게임방 생성에 실패했습니다.' });
        setIsCreating(false);
    }
  };

  if (isLoading || loadingUser) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">게임 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!gameSet) {
    return <div className="container mx-auto py-8">게임 세트를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">새로운 게임방 만들기</CardTitle>
          <CardDescription>'{gameSet.title}' 퀴즈로 게임을 시작합니다. 설정을 완료하고 방을 만드세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">게임 설정</h3>
            <div className="p-4 border rounded-lg space-y-4">
               <div className="flex items-center justify-between">
                <Label htmlFor="mystery-box" className="flex flex-col gap-1">
                    <span>미스터리 박스 사용</span>
                    <span className="text-xs text-muted-foreground">게임에 특수 효과를 추가합니다.</span>
                </Label>
                <Switch
                  id="mystery-box"
                  checked={mysteryBoxEnabled}
                  onCheckedChange={setMysteryBoxEnabled}
                />
              </div>

              <div className="space-y-2">
                <Label>참여 방식</Label>
                <TooltipProvider>
                 <RadioGroup
                    value={joinType}
                    onValueChange={(value: string) => setJoinType(value as JoinType)}
                    className="grid grid-cols-2 gap-4"
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <RadioGroupItem value="remote" id="remote" className="peer sr-only" disabled />
                          <Label
                            htmlFor="remote"
                            className={cn("flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 cursor-not-allowed opacity-50",
                              "[&:has([data-state=checked])]:border-primary"
                            )}
                          >
                            <Users className="mb-3 h-6 w-6" />
                            여러 기기에서 참여
                          </Label>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>아직 개발 전입니다.</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    <div>
                      <RadioGroupItem value="local" id="local" className="peer sr-only" />
                      <Label
                        htmlFor="local"
                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                      >
                        <Smartphone className="mb-3 h-6 w-6" />
                        한 기기에서 참여
                      </Label>
                    </div>
                  </RadioGroup>
                </TooltipProvider>
              </div>

            </div>
          </div>

           <div className="space-y-2">
            <h3 className="font-semibold">보안 설정</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="p-4 border rounded-lg space-y-4 opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="use-password" className="flex flex-col gap-1 cursor-not-allowed">
                          <span>비밀번호 사용</span>
                           <span className="text-xs text-muted-foreground">비밀번호를 아는 사람만 입장할 수 있습니다.</span>
                      </Label>
                      <Switch
                        id="use-password"
                        checked={usePassword}
                        disabled
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>아직 개발 전입니다.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <Button onClick={handleCreateRoom} disabled={isCreating || hasPlayedToday || (usePassword && !password)} className="w-full font-headline" size="lg">
            {isCreating ? '방 만드는 중...' : hasPlayedToday ? '오늘 이미 플레이한 게임입니다' : <><Users className="mr-2 h-5 w-5" /> 게임방 만들기</>}
          </Button>
          {hasPlayedToday && (
            <p className="text-sm text-center text-muted-foreground">내일 다시 시도해주세요.</p>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

export default function NewGameRoomPage() {
  return (
    <Suspense fallback={<div className="container mx-auto py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">페이지를 불러오는 중...</p>
      </div>}>
      <NewGameRoomPageContents />
    </Suspense>
  )
}
