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
import type { GameSet, GameRoom } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Lock, Users } from 'lucide-react';

export default function NewGameRoomPage() {
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameSetId = searchParams.get('gameSetId');
  const { toast } = useToast();

  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [mysteryBoxEnabled, setMysteryBoxEnabled] = useState(true);

  useEffect(() => {
    if (!gameSetId) {
      toast({ variant: 'destructive', title: '오류', description: '게임 세트 ID가 필요합니다.' });
      router.push('/dashboard');
      return;
    }

    const fetchGameSet = async () => {
      setIsLoading(true);
      const docRef = doc(db, 'game-sets', gameSetId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setGameSet({ id: docSnap.id, ...docSnap.data() } as GameSet);
      } else {
        toast({ variant: 'destructive', title: '오류', description: '게임 세트를 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
      setIsLoading(false);
    };

    fetchGameSet();
  }, [gameSetId, router, toast]);

  const handleCreateRoom = async () => {
    if (!user || !gameSet) return;
    
    setIsCreating(true);

    try {
      const newRoom: Omit<GameRoom, 'id'> = {
        gameSetId: gameSet.id,
        status: 'waiting',
        hostId: user.uid,
        currentTurn: user.uid,
        players: {},
        gameState: {},
        mysteryBoxEnabled: mysteryBoxEnabled,
        ...(usePassword && password && { password }),
      };

      const docRef = await addDoc(collection(db, 'game-rooms'), {
          ...newRoom,
          createdAt: serverTimestamp(),
      });
      
      toast({ title: '성공', description: '새로운 게임방을 만들었습니다!' });
      router.push(`/game/${docRef.id}/lobby`);

    } catch (error) {
        console.error("Error creating game room:", error);
        toast({ variant: 'destructive', title: '오류', description: '게임방 생성에 실패했습니다.' });
        setIsCreating(false);
    }
  };

  if (isLoading || loadingUser) {
    return <div className="container mx-auto py-8">게임 정보를 불러오는 중...</div>;
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
            </div>
          </div>

           <div className="space-y-2">
            <h3 className="font-semibold">보안 설정</h3>
            <div className="p-4 border rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="use-password" className="flex flex-col gap-1">
                    <span>비밀번호 사용</span>
                     <span className="text-xs text-muted-foreground">비밀번호를 아는 사람만 입장할 수 있습니다.</span>
                </Label>
                <Switch
                  id="use-password"
                  checked={usePassword}
                  onCheckedChange={(checked) => {
                    setUsePassword(checked);
                    if (!checked) setPassword('');
                  }}
                />
              </div>
              {usePassword && (
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
            </div>
          </div>
          
          <Button onClick={handleCreateRoom} disabled={isCreating || (usePassword && !password)} className="w-full font-headline" size="lg">
            {isCreating ? '방 만드는 중...' : <><Users className="mr-2 h-5 w-5" /> 게임방 만들기</>}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
