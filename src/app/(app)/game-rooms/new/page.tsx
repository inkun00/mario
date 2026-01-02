
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
import { Switch } from '@/components/ui/switch';
import { db, auth } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, JoinType, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense, useCallback } from 'react';
import { Users, Loader2 } from 'lucide-react';
import Link from 'next/link';

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
  const joinType = searchParams.get('joinType') as JoinType | null;
  const { toast } = useToast();

  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [roomTitle, setRoomTitle] = useState('');
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  
  const handleCreateRoom = useCallback(async () => {
    if (!user || !gameSet || !joinType) return;
    
    if (joinType === 'remote' && !roomTitle) {
        toast({
            variant: 'destructive',
            title: '오류',
            description: '방 제목을 입력해주세요.',
        });
        return;
    }

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
        throw new Error('고유한 방 ID 생성에 실패했습니다.');
      }
      
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.data() as User | undefined;

      const hostPlayer: Player = {
        uid: user.uid,
        nickname: user.displayName || '호스트',
        score: 0,
        pixelAvatar: userData?.pixelAvatar,
        isHost: true,
      };
      
      const newRoom: Omit<GameRoom, 'id' | 'createdAt'> = {
        roomTitle: joinType === 'local' ? `${gameSet.title} (로컬)` : roomTitle,
        gameSetId: gameSet.id,
        status: 'waiting',
        hostId: user.uid,
        currentTurn: user.uid,
        players: {
            [user.uid]: hostPlayer
        },
        gameState: {},
        mysteryBoxEnabled: true,
        isMysterySettingDone: false,
        joinType: joinType,
        ...(usePassword && password && { password }),
        mysteryEffectVotes: {},
        joinRequests: [],
      };

      await setDoc(doc(db, "game-rooms", newRoomId), {
          ...newRoom,
          createdAt: serverTimestamp(),
      });
      
      const gameSetRef = doc(db, 'game-sets', gameSet.id);
      await updateDoc(gameSetRef, {
        playCount: increment(1)
      });
      
      toast({ title: '성공', description: '새로운 게임방을 만들었습니다!' });
      router.push(`/game/${newRoomId}/lobby`);

    } catch (error) {
        console.error("Error creating game room:", error);
        toast({ variant: 'destructive', title: '오류', description: '게임방 생성에 실패했습니다.' });
        setIsCreating(false);
    }
  }, [user, gameSet, joinType, roomTitle, usePassword, password, toast, router]);

  useEffect(() => {
    if (loadingUser) return;
    
    if (!user) {
        router.push('/login');
        return;
    }

    if (!gameSetId || !joinType) {
      toast({ variant: 'destructive', title: '오류', description: '잘못된 접근입니다.' });
      router.push('/dashboard');
      return;
    }
    
    const fetchGameSet = async () => {
      const setDocRef = doc(db, 'game-sets', gameSetId);
      const setDocSnap = await getDoc(setDocRef);

      if (setDocSnap.exists()) {
        const gameSetData = { id: setDocSnap.id, ...setDocSnap.data() } as GameSet;
        setGameSet(gameSetData);
        setRoomTitle(`${gameSetData.title} 게임방`);
      } else {
        toast({ variant: 'destructive', title: '오류', description: '게임 세트를 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
      setIsPageLoading(false);
    };

    fetchGameSet();
  }, [gameSetId, joinType, user, loadingUser, router, toast]);

  useEffect(() => {
    if (joinType === 'local' && gameSet) {
        handleCreateRoom();
    }
  }, [joinType, gameSet, handleCreateRoom]);

  if (isPageLoading || loadingUser || joinType === 'local') {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">게임방을 준비하는 중...</p>
      </div>
    );
  }

  if (!gameSet) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">새로운 온라인 게임방 만들기</CardTitle>
          <CardDescription>'{gameSet.title}' 퀴즈로 게임을 시작합니다. 설정을 완료하고 방을 만드세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="font-semibold">게임 설정</h3>
            <div className="p-4 border rounded-lg space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="room-title">방 제목</Label>
                  <Input 
                    id="room-title"
                    placeholder="친구들이 알아볼 수 있는 방 제목을 입력하세요."
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="use-password" className="flex flex-col gap-1">
                      <span>비밀번호 사용</span>
                        <span className="text-xs text-muted-foreground">비밀번호를 아는 사람만 입장할 수 있습니다.</span>
                  </Label>
                  <Switch
                    id="use-password"
                    checked={usePassword}
                    onCheckedChange={setUsePassword}
                  />
                </div>
                {usePassword && (
                  <div className="space-y-2">
                    <Label htmlFor="password">게임방 비밀번호</Label>
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="비밀번호 입력"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                )}
            </div>
          </div>
          
          <Button onClick={handleCreateRoom} disabled={isCreating} className="w-full font-headline" size="lg">
            {isCreating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>방 만드는 중...</> : <><Users className="mr-2 h-5 w-5" /> 게임방 만들기</>}
          </Button>
           <p className="text-sm text-center text-muted-foreground">
              <Link href="/dashboard" className="hover:underline text-primary">
                다른 퀴즈를 플레이하려면 여기를 클릭하세요.
              </Link>
            </p>

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
