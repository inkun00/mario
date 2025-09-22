
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Crown, Users, LogIn, Loader2, Gamepad2, UserCheck, CheckCircle } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { checkUserId } from '@/ai/flows/check-nickname-flow';

function RemoteLobby({ gameRoom, gameSet }: { gameRoom: GameRoom, gameSet: GameSet | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [user, loadingUser] = useAuthState(auth);
    const players = Object.values(gameRoom.players).sort(a => a.isHost ? -1 : 1);
    const isHost = user?.uid === gameRoom?.hostId;
    const isPlayer = user && gameRoom?.players[user.uid];

    const copyToClipboard = () => {
        navigator.clipboard.writeText(gameRoom.id as string).then(() => {
            toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
        });
    };

    const handleStartGame = async () => {
        if (!isHost) return;
        const roomRef = doc(db, 'game-rooms', gameRoom.id as string);
        try {
            await updateDoc(roomRef, { status: 'playing' });
            // The onSnapshot listener in the main component will handle the redirection
        } catch (error) {
            console.error("Error starting game: ", error);
            toast({ variant: 'destructive', title: '오류', description: '게임을 시작하는 중 오류가 발생했습니다.'});
        }
    };

    return (
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
                        <p className="text-2xl font-bold font-mono tracking-widest">{gameRoom.id}</p>
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
                                        <div className="absolute -top-1 -right-2 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs flex items-center gap-1" >
                                            <Crown className="w-3 h-3" />
                                            호스트
                                        </div>
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
                                // This case should ideally not happen if they are in the lobby
                                <Button disabled>
                                    <LogIn className="w-4 h-4 mr-2" /> 참여하여 시작
                                </Button>
                            )}
                         </div>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}


function LocalLobby({ gameRoom, gameSet }: { gameRoom: GameRoom, gameSet: GameSet | null }) {
    const [numPlayers, setNumPlayers] = useState(2);
    const [players, setPlayers] = useState<Array<{userId: string; uid: string; nickname: string; confirmed: boolean; isChecking: boolean }>>([]);
    const { toast } = useToast();

    useEffect(() => {
        setPlayers(Array.from({ length: numPlayers }, () => ({ userId: '', uid: '', nickname: '', confirmed: false, isChecking: false })));
    }, [numPlayers]);
    
    const handleUserIdChange = (index: number, userId: string) => {
        const newPlayers = [...players];
        newPlayers[index].userId = userId;
        newPlayers[index].confirmed = false;
        newPlayers[index].nickname = '';
        newPlayers[index].uid = '';
        setPlayers(newPlayers);
    };

    const handleConfirmPlayer = async (index: number) => {
        const newPlayers = [...players];
        newPlayers[index].isChecking = true;
        setPlayers(newPlayers);

        const userId = players[index].userId;
        if (!userId) {
            toast({ variant: 'destructive', title: '오류', description: '아이디를 입력해주세요.'});
            newPlayers[index].isChecking = false;
            setPlayers(newPlayers);
            return;
        }

        try {
            const result = await checkUserId({ userId });
            
            if (result.exists && result.uid) {
                // Client-side verification: Cross-check if the UID from the flow actually exists in Firestore.
                const userRef = doc(db, 'users', result.uid);
                const userSnap = await getDoc(userRef);

                if (!userSnap.exists()) {
                    // This is the "ghost UID" case. The flow returned a UID that doesn't exist in our users collection.
                    console.warn(`Verification failed: Flow returned UID ${result.uid} for ${userId}, but it does not exist in Firestore.`);
                    toast({ variant: 'destructive', title: '오류', description: `"${userId}" 님을 찾을 수 없습니다.`});
                } else {
                    // UID is verified. Now, check if it's the game creator.
                    if (gameSet && gameSet.creatorId === result.uid) {
                        toast({ variant: 'destructive', title: '참여 불가', description: `제작자(${result.nickname})는 자신이 만든 퀴즈에 참여할 수 없습니다.`});
                    } else {
                        newPlayers[index].confirmed = true;
                        newPlayers[index].nickname = result.nickname;
                        newPlayers[index].uid = result.uid;
                        toast({ title: '성공', description: `"${result.nickname}" 님이 확인되었습니다.`});
                    }
                }
            } else {
                toast({ variant: 'destructive', title: '오류', description: `"${userId}" 님을 찾을 수 없습니다.`});
            }
        } catch (error: any) {
            console.error("Error confirming player:", error);
            toast({ variant: 'destructive', title: '오류', description: `아이디 확인 중 오류가 발생했습니다: ${error.message}`});
        } finally {
            newPlayers[index].isChecking = false;
            setPlayers(newPlayers);
        }
    };
    
    const handleStartGame = async () => {
        if (players.some(p => !p.confirmed)) {
            toast({ variant: 'destructive', title: '오류', description: '모든 플레이어를 확인해주세요.'});
            return;
        }
        
        const roomRef = doc(db, 'game-rooms', gameRoom.id as string);

        const playerObjects: Record<string, Player> = {};
        const playerUIDs: string[] = [];

        players.forEach((p, index) => {
            const newPlayer: Player = {
                uid: p.uid,
                nickname: p.nickname,
                score: 0,
                avatarId: `player-avatar-${(index % 4) + 1}`,
                isHost: index === 0, // First confirmed player is host
            };
            playerObjects[p.uid] = newPlayer;
            playerUIDs.push(p.uid);
        });

        try {
            await updateDoc(roomRef, { 
                status: 'playing',
                players: playerObjects,
                playerUIDs: playerUIDs, // Add the ordered list of UIDs
                currentTurn: playerUIDs[0], // First player's turn
                hostId: playerUIDs[0]
            });
            // The onSnapshot listener will handle redirection.
        } catch (error) {
            console.error("Error starting local game:", error);
            toast({ variant: 'destructive', title: '오류', description: '게임 시작 중 오류가 발생했습니다.'});
        }
    };


    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader className="text-center">
                 <p className="text-sm text-muted-foreground">{[gameSet?.grade, gameSet?.semester, gameSet?.subject].filter(Boolean).join(' / ')}</p>
                <CardTitle className="font-headline text-3xl">{gameSet?.title || '로컬 게임 로비'}</CardTitle>
                <CardDescription>함께 플레이할 친구들의 아이디를 입력하고 확인해주세요. 첫 번째 플레이어가 호스트가 됩니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-lg font-semibold">참여 인원</Label>
                    <RadioGroup value={String(numPlayers)} onValueChange={(val) => setNumPlayers(Number(val))} className="grid grid-cols-3 md:grid-cols-5 gap-2">
                        {[2, 3, 4, 5, 6].map(num => (
                             <div key={num}>
                                <RadioGroupItem value={String(num)} id={`players-${num}`} className="peer sr-only" />
                                <Label htmlFor={`players-${num}`} className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    {num}명
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">플레이어 설정</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {players.map((player, index) => (
                            <div key={index} className="space-y-2 p-4 border rounded-lg">
                                <Label htmlFor={`userId-${index}`}>플레이어 {index + 1} {index === 0 && '(호스트)'}</Label>
                                {player.confirmed ? (
                                    <div className="flex items-center justify-between h-10 px-3 py-2 text-sm rounded-md border border-transparent bg-secondary">
                                        <span className="font-semibold">{player.nickname}</span>
                                        <span className="text-primary flex items-center gap-1"><CheckCircle className="w-4 h-4"/> 참여 완료</span>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Input 
                                            id={`userId-${index}`}
                                            placeholder="아이디(이메일) 입력"
                                            value={player.userId}
                                            onChange={(e) => handleUserIdChange(index, e.target.value)}
                                            disabled={player.isChecking}
                                        />
                                        <Button onClick={() => handleConfirmPlayer(index)} disabled={player.isChecking}>
                                            {player.isChecking ? <Loader2 className="w-4 h-4 animate-spin"/> : "참여"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                 <div className="flex flex-col items-center gap-4 pt-4">
                    <Button size="lg" className="font-headline text-lg" onClick={handleStartGame} disabled={players.some(p => !p.confirmed)}>
                       <Gamepad2 className="w-5 h-5 mr-2" /> 게임 시작
                    </Button>
                 </div>
            </CardContent>
        </Card>
    )
}


export default function LobbyPage() {
  const [user, loadingUser] = useAuthState(auth);
  const { id: gameRoomId } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [gameRoom, setGameRoom] = useState<GameRoom | null>(null);
  const [gameSet, setGameSet] = useState<GameSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameRoomId) return;

    const roomRef = doc(db, 'game-rooms', gameRoomId as string);
    const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
      if (docSnap.exists()) {
        const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
        setGameRoom(roomData);

        // Check if game has started and redirect if needed
        if (roomData.status === 'playing') {
            router.push(`/game/${gameRoomId}`);
            return; // Stop further processing for this snapshot
        }

        if (!gameSet && roomData.gameSetId) {
            const setRef = doc(db, 'game-sets', roomData.gameSetId);
            const setSnap = await getDoc(setRef);
            if(setSnap.exists()) {
                setGameSet({ id: setSnap.id, ...setSnap.data()} as GameSet);
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
  
  if (isLoading || loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 로비 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (!gameRoom) {
      return null;
  }

  return (
    <div className="container mx-auto py-8">
        {gameRoom.joinType === 'local' 
            ? <LocalLobby gameRoom={gameRoom} gameSet={gameSet}/> 
            : <RemoteLobby gameRoom={gameRoom} gameSet={gameSet} />
        }
    </div>
  )
}

    