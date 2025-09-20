'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Copy, Crown, Users, LogIn, Loader2, Gamepad2 } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';


export default function LobbyPage() {
  const [user, loadingUser] = useAuthState(auth);
  const { id: gameRoomId } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameRoomId) return;

    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
        setGameRoom(roomData);
        setPlayers(Object.values(roomData.players).sort(a => a.isHost ? -1 : 1));

        if (!gameSet && roomData.gameSetId) {
            const setRef = doc(db, 'game-sets', roomData.gameSetId);
            const setSnap = await getDoc(setRef);
            if(setSnap.exists()) {
                setGameSet({ id: setSnap.id, ...setSnap.data()} as GameSet);
            }
        }
        
        if (roomData.status === 'playing') {
            router.push(`/game/${gameRoomId}`);
        }

      } else {
        toast({ variant: 'destructive', title: '오류', description: '게임방을 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [gameRoomId, router, toast, gameSet]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gameRoomId as string).then(() => {
      toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
    });
  };

  const handleStartGame = async () => {
    if (user?.uid !== gameRoom?.hostId) return;
    
    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    await updateDoc(roomRef, {
        status: 'playing',
    });
    router.push(`/game/${gameRoomId}`);
  };

  if (isLoading || loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 로비 정보를 불러오는 중...</p>
      </div>
    );
  }

  const isHost = user?.uid === gameRoom?.hostId;
  const isPlayer = user && gameRoom?.players[user.uid];

  return (
    <div className="container mx-auto py-8">
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center">
                <p className="text-sm text-muted-foreground">{[gameSet?.grade, gameSet?.semester, gameSet?.subject].filter(Boolean).join(' / ')}</p>
                <CardTitle className="font-headline text-3xl">{gameSet?.title || '게임 로비'}</CardTitle>
                <CardDescription>모든 플레이어가 들어오면 호스트가 게임을 시작합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="bg-secondary/50 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                   <div className="text-center md:text-left">
                        <p className="text-sm font-medium text-muted-foreground">참여 코드</p>
                        <p className="text-2xl font-bold font-mono tracking-widest">{gameRoomId}</p>
                   </div>
                    <Button onClick={copyToClipboard} variant="outline"><Copy className="w-4 h-4 mr-2" />코드 복사</Button>
                </div>
                
                <div className="space-y-4">
                    <h3 className="font-headline text-xl font-semibold flex items-center gap-2">
                        <Users className="w-6 h-6"/>
                        <span>참여한 플레이어 ({players.length})</span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {players.map(player => (
                            <div key={player.uid} className="flex flex-col items-center gap-2 p-3 border rounded-lg bg-background">
                                 <div className="relative">
                                    <Avatar className="w-16 h-16">
                                        <Image src={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageUrl || ''} alt={player.nickname} width={64} height={64} className="rounded-full" data-ai-hint={PlaceHolderImages.find(p => p.id === player.avatarId)?.imageHint}/>
                                        <AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback>
                                    </Avatar>
                                    {player.isHost && (
                                        <Badge className="absolute -top-1 -right-2 pl-1 pr-2 py-0.5" >
                                            <Crown className="w-3 h-3 mr-1" />
                                            호스트
                                        </Badge>
                                    )}
                                </div>
                                <p className="font-semibold text-center">{player.nickname}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                    {isHost ? (
                        <Button onClick={handleStartGame} size="lg" className="font-headline text-lg">
                           <Gamepad2 className="w-5 h-5 mr-2" /> 게임 시작
                        </Button>
                    ) : (
                         <div className="text-center">
                            {isPlayer ? (
                                <p className="text-muted-foreground">호스트가 게임을 시작하기를 기다리고 있습니다...</p>
                            ) : (
                                <Button disabled>
                                    <LogIn className="w-4 h-4 mr-2" /> 참여하여 시작
                                </Button>
                            )}
                         </div>
                    )}
                </div>

            </CardContent>
        </Card>
    </div>
  )
}
