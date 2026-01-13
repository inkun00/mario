
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, collection, query, where, getDocs, limit, arrayUnion, serverTimestamp, deleteField, deleteDoc, setDoc, arrayRemove, runTransaction } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { GameRoom, GameSet, Player, PlayedGameSet, User as FsUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Crown, Users, LogIn, Loader2, Gamepad2, UserCheck, CheckCircle, Eye, EyeOff, Lock, XCircle, LogOut } from 'lucide-react';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ADMIN_EMAILS } from '@/lib/admins';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

function RemoteLobby({ gameRoom, gameSet }: { gameRoom: GameRoom, gameSet: GameSet | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [user, loadingUser] = useAuthState(auth);
    const players = Object.values(gameRoom.players).sort(a => a.isHost ? -1 : 1);
    const isHost = user?.uid === gameRoom?.hostId;
    
    const [kickCandidate, setKickCandidate] = useState<Player | null>(null);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(gameRoom.id as string).then(() => {
            toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
        });
    };

    const handleStartGame = async () => {
        if (!isHost) return;
        const roomRef = doc(db, 'game-rooms', gameRoom.id as string);
        try {
            const playerUIDs = Object.values(gameRoom.players)
                .sort((a, b) => (a.isHost ? -1 : 1)) 
                .map(p => p.uid);

            await updateDoc(roomRef, { 
              status: gameRoom.mysteryBoxEnabled ? 'setting-mystery' : 'playing',
              playerUIDs: playerUIDs,
              currentTurn: playerUIDs[0],
            });

        } catch (error) {
            console.error("Error starting game: ", error);
            toast({ variant: 'destructive', title: '오류', description: '게임을 시작하는 중 오류가 발생했습니다.'});
        }
    };
    
    const handleLeaveRoom = async () => {
        if (!user || !gameRoom) return;

        if (isHost) {
            // If host leaves, delete the room
            try {
                await deleteDoc(doc(db, 'game-rooms', gameRoom.id));
                toast({ title: '방 삭제됨', description: '호스트가 방을 나가서 게임방이 삭제되었습니다.' });
                router.push('/dashboard');
            } catch (error) {
                console.error('Error deleting room:', error);
                toast({ variant: 'destructive', title: '오류', description: '방을 삭제하는 중 오류가 발생했습니다.' });
            }
        } else {
            // If a player leaves, remove them from the players list
            const roomRef = doc(db, 'game-rooms', gameRoom.id as string);
            try {
                await updateDoc(roomRef, {
                    [`players.${user.uid}`]: deleteField(),
                    playerUIDs: arrayRemove(user.uid),
                });
                toast({ title: '방을 나갔습니다.' });
                router.push('/dashboard');
            } catch (error) {
                console.error('Error leaving room:', error);
                toast({ variant: 'destructive', title: '오류', description: '방을 나가는 중 오류가 발생했습니다.' });
            }
        }
    };
    
    const handleKickPlayer = async () => {
        if (!isHost || !kickCandidate) return;

        const roomRef = doc(db, 'game-rooms', gameRoom.id as string);
        try {
            await updateDoc(roomRef, {
                [`players.${kickCandidate.uid}`]: deleteField(),
                playerUIDs: arrayRemove(kickCandidate.uid),
            });
            toast({ title: '성공', description: `${kickCandidate.nickname} 님을 내보냈습니다.` });
            setKickCandidate(null);
        } catch (error) {
            console.error("Error kicking player:", error);
            toast({ variant: 'destructive', title: '오류', description: '플레이어를 내보내는 중 오류가 발생했습니다.'});
        }
    };

    return (
        <>
            <Card className="max-w-4xl mx-auto">
                <CardHeader className="text-center">
                    <CardTitle className="font-headline text-3xl">{gameRoom?.roomTitle}</CardTitle>
                    <CardDescription>모든 플레이어가 들어오면 호스트가 게임을 시작합니다. 최대 6명까지 참여 가능합니다.</CardDescription>
                    <p className="text-sm text-muted-foreground">{gameSet?.title}</p>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="bg-secondary/50 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                       <div className="text-center md:text-left">
                            <p className="text-sm font-medium text-muted-foreground">참여 코드</p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl font-bold font-mono tracking-widest">{gameRoom.id}</p>
                                {gameRoom.password && <Lock className="w-5 h-5 text-muted-foreground"/>}
                            </div>
                       </div>
                        <Button onClick={copyToClipboard} variant="outline"><Copy className="w-4 h-4 mr-2" />코드 복사</Button>
                    </div>
                    
                    <div className="space-y-4">
                        <h3 className="font-headline text-xl font-semibold flex items-center gap-2">
                            <Users className="w-6 h-6"/>
                            <span>참여한 플레이어 ({players.length} / 6)</span>
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {players.map(player => {
                                let pixelAvatarData = null;
                                if (player.pixelAvatar) {
                                    try { pixelAvatarData = JSON.parse(player.pixelAvatar); } catch (e) { console.error("Error parsing player avatar in lobby", e); }
                                }
                                return (
                                    <div key={player.uid} className={cn(
                                        "group relative flex flex-col items-center gap-2 p-3 border-2 rounded-lg bg-background",
                                        player.uid === user?.uid ? "border-primary" : "border-transparent"
                                    )}>
                                        <div className="relative">
                                            <Avatar className="w-20 h-20">
                                                {pixelAvatarData ? (
                                                    <PixelAvatar pixels={pixelAvatarData} />
                                                ) : (
                                                    <AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                            {player.isHost && (
                                                <div className="absolute -top-1 -right-2 bg-primary text-primary-foreground rounded-full p-1 text-xs flex items-center gap-1" >
                                                    <Crown className="w-3 h-3" />
                                                </div>
                                            )}
                                            {isHost && !player.isHost && (
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => setKickCandidate(player)}
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </Button>
                                            )}
                                        </div>
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <p className="text-sm font-medium truncate max-w-[80px]">{player.nickname}</p>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{player.nickname}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-4 border-t">
                        {isHost ? (
                            <Button onClick={handleStartGame} size="lg" className="font-headline text-lg" disabled={players.length < 2}>
                               <Gamepad2 className="w-5 h-5 mr-2" /> {players.length < 2 ? "2명 이상 필요" : "게임 시작"}
                            </Button>
                        ) : (
                             <div className="text-center">
                                <p className="text-muted-foreground">호스트가 게임을 시작하기를 기다리고 있습니다...</p>
                             </div>
                        )}
                         <Button onClick={handleLeaveRoom} variant="destructive" size="sm">
                            <LogOut className="w-4 h-4 mr-2" /> 방 나가기
                        </Button>
                    </div>

                </CardContent>
            </Card>
            
            <AlertDialog open={!!kickCandidate} onOpenChange={(isOpen) => !isOpen && setKickCandidate(null)}>
                <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>정말 내보내시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                    {kickCandidate?.nickname}님을 게임방에서 내보냅니다. 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction onClick={handleKickPlayer} className="bg-destructive hover:bg-destructive/90">내보내기</AlertDialogAction>
                </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}


function LocalLobby({ gameRoom, gameSet }: { gameRoom: GameRoom, gameSet: GameSet | null }) {
    const [user] = useAuthState(auth);
    const router = useRouter();
    const { toast } = useToast();
    
    const [numPlayers, setNumPlayers] = useState(2);
    const [playerInputs, setPlayerInputs] = useState<string[]>([]);
    const [confirmedPlayers, setConfirmedPlayers] = useState<{ uid: string; nickname: string }[]>([]);
    const [isChecking, setIsChecking] = useState<number | null>(null);

    useEffect(() => {
        setPlayerInputs(Array(numPlayers).fill(''));
        setConfirmedPlayers([]);
    }, [numPlayers]);
    
    const handlePlayerIdChange = (index: number, value: string) => {
        const newInputs = [...playerInputs];
        newInputs[index] = value;
        setPlayerInputs(newInputs);
    };

    const handleConfirmPlayer = async (index: number) => {
        setIsChecking(index);
        const userId = playerInputs[index];

        if (!userId) {
            toast({ variant: 'destructive', title: '오류', description: '아이디(이메일)를 입력해주세요.'});
            setIsChecking(null);
            return;
        }

        try {
            const usersRef = collection(db, 'users');
            const qUser = query(usersRef, where('email', '==', userId), limit(1));
            const userSnapshot = await getDocs(qUser);

            if (userSnapshot.empty) {
                 toast({ variant: 'destructive', title: '오류', description: `"${userId}" 님을 찾을 수 없습니다.`});
                 setIsChecking(null);
                 return;
            }

            const userDoc = userSnapshot.docs[0];
            const userData = userDoc.data() as FsUser;
            const playerUid = userDoc.id;

            const isDuplicate = confirmedPlayers.some(p => p.uid === playerUid);
            if (isDuplicate) {
                toast({ variant: 'destructive', title: '중복 참여', description: `"${userData.displayName}" 님은 이미 참여 중입니다.`});
                const newInputs = [...playerInputs];
                newInputs[index] = '';
                setPlayerInputs(newInputs);
                setIsChecking(null);
                return;
            }
            
            if (gameSet && gameSet.creatorId === playerUid && user?.email && !ADMIN_EMAILS.includes(user.email)) {
                 toast({ variant: 'destructive', title: '참여 불가', description: `제작자(${userData.displayName})는 자신이 만든 퀴즈에 참여할 수 없습니다.`});
                 setIsChecking(null);
                 return;
            }
            
            const newConfirmedPlayers = [...confirmedPlayers];
            newConfirmedPlayers[index] = { uid: playerUid, nickname: userData.displayName || '이름없음' };
            setConfirmedPlayers(newConfirmedPlayers);
            toast({ title: '성공', description: `"${userData.displayName}" 님이 확인되었습니다.`});

        } catch (error: any) {
            toast({ variant: 'destructive', title: '오류', description: error.message || '사용자 확인 중 오류가 발생했습니다.' });
        }
        
        setIsChecking(null);
    };
    
    const handleStartGame = async () => {
        if (confirmedPlayers.filter(Boolean).length !== numPlayers) {
            toast({ variant: 'destructive', title: '오류', description: '모든 플레이어를 확인해주세요.'});
            return;
        }
        
        const roomRef = doc(db, 'game-rooms', gameRoom.id as string);

        const playerObjects: Record<string, Player> = {};
        const playerUIDs: string[] = [];

        confirmedPlayers.forEach((p, index) => {
            if (p) {
                playerObjects[p.uid] = {
                    uid: p.uid,
                    nickname: p.nickname,
                    score: 0,
                    isHost: index === 0,
                };
                playerUIDs.push(p.uid);
            }
        });

        try {
            await setDoc(roomRef, { 
                status: gameRoom.mysteryBoxEnabled ? 'setting-mystery' : 'playing',
                players: playerObjects,
                playerUIDs: playerUIDs,
                currentTurn: playerUIDs[0],
                hostId: playerUIDs[0],
                gameStartedAt: serverTimestamp()
            }, { merge: true });
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
                <CardDescription>함께 플레이할 친구들의 아이디를 입력하고 확인해주세요.</CardDescription>
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
                        {Array.from({ length: numPlayers }).map((_, index) => {
                            const confirmedPlayer = confirmedPlayers[index];
                            return (
                                <div key={index} className="space-y-2 p-4 border rounded-lg">
                                    <Label>플레이어 {index + 1} {index === 0 && "(호스트)"}</Label>
                                    {confirmedPlayer ? (
                                        <div className="flex items-center justify-between h-[2.5rem] px-3 py-2 text-sm rounded-md border border-transparent bg-secondary">
                                            <span className="font-semibold">{confirmedPlayer.nickname}</span>
                                            <span className="text-primary flex items-center gap-1"><CheckCircle className="w-4 h-4"/> 참여 완료</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Input 
                                                placeholder="아이디(이메일) 입력"
                                                value={playerInputs[index]}
                                                onChange={(e) => handlePlayerIdChange(index, e.target.value)}
                                                disabled={isChecking === index}
                                                autoComplete="off"
                                            />
                                            <Button onClick={() => handleConfirmPlayer(index)} disabled={isChecking === index || !playerInputs[index]} size="sm">
                                                {isChecking === index ? <Loader2 className="w-4 h-4 animate-spin"/> : "확인"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                 <div className="flex flex-col items-center gap-4 pt-4">
                    <Button size="lg" className="font-headline text-lg" onClick={handleStartGame} disabled={confirmedPlayers.filter(Boolean).length !== numPlayers}>
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
  const [firestoreUser, setFirestoreUser] = useState<FsUser | null>(null);

  const joinRoom = useCallback(async (userToJoin: FsUser, roomRef: any) => {
    if (!gameRoomId || typeof gameRoomId !== 'string') return;
    try {
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) {
                throw new Error("Game room not found");
            }
            const roomData = roomDoc.data() as GameRoom;

            if (roomData.players && roomData.players[userToJoin.uid]) {
                return;
            }

            if (Object.keys(roomData.players).length >= 6) {
                toast({ variant: 'destructive', title: '방이 꽉 찼습니다.', description: '최대 6명까지 참여 가능합니다.'});
                router.push('/dashboard');
                return;
            }
            
            const newPlayer: Player = {
                uid: userToJoin.uid,
                nickname: userToJoin?.displayName || `플레이어${Object.keys(roomData.players).length + 1}`,
                score: 0,
                pixelAvatar: userToJoin?.pixelAvatar,
                isHost: false,
            };

            transaction.update(roomRef, {
                [`players.${userToJoin.uid}`]: newPlayer,
                playerUIDs: arrayUnion(userToJoin.uid)
            });
        });
    } catch (error) {
        console.error('Failed to join room:', error);
        toast({ variant: 'destructive', title: '참여 실패', description: '게임방에 참여하는 중 오류가 발생했습니다.'});
        router.push('/dashboard');
    }
  }, [gameRoomId, router, toast]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setFirestoreUser(docSnap.data() as FsUser);
      } else {
        toast({ variant: 'destructive', title: '오류', description: '사용자 정보를 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
    });
    return () => unsubscribe();
  }, [user, router, toast]);

  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string' || loadingUser || !user) {
      return;
    }
  
    const roomRef = doc(db, 'game-rooms', gameRoomId);
  
    const initializeLobby = async () => {
      try {
        const initialRoomSnap = await getDoc(roomRef);
        if (!initialRoomSnap.exists()) {
          toast({ variant: 'destructive', title: '오류', description: '게임방을 찾을 수 없습니다.' });
          router.push('/dashboard');
          return;
        }
  
        const roomData = initialRoomSnap.data() as GameRoom;
        if (roomData.joinType === 'remote') {
          const isPlayerInRoom = !!roomData.players[user.uid];
          if (!isPlayerInRoom) {
            const userSnap = await getDoc(doc(db, 'users', user.uid));
            if (userSnap.exists()) {
              await joinRoom(userSnap.data() as FsUser, roomRef);
            }
          }
        }
      } catch (error) {
        console.error("Error initializing lobby:", error);
        toast({ variant: 'destructive', title: '오류', description: '로비에 참여하는 중 오류가 발생했습니다.' });
        router.push('/dashboard');
        return;
      }
  
      // After initial join attempt, set up the real-time listener
      const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
        if (docSnap.exists()) {
          const roomData = { id: docSnap.id, ...docSnap.data() } as GameRoom;
  
          if (roomData.joinType === 'remote' && roomData.status === 'waiting' && roomData.hostId && (!roomData.players || !Object.keys(roomData.players).length)) {
            toast({ variant: 'destructive', title: '오류', description: '호스트가 방을 나갔습니다. 다른 방에 참여해주세요.' });
            router.push('/dashboard');
            return;
          }
  
          if (gameRoom && gameRoom.players[user.uid] && !roomData.players[user.uid]) {
            toast({ variant: "destructive", title: "방에서 내보내졌습니다.", description: "호스트에 의해 게임방에서 내보내졌습니다." });
            router.push('/dashboard');
            return;
          }
  
          setGameRoom(roomData);
  
          if (roomData.status === 'playing' || roomData.status === 'setting-mystery') {
            router.push(`/game/${gameRoomId}`);
            return;
          }
  
          if (!gameSet && roomData.gameSetId) {
            const setRef = doc(db, 'game-sets', roomData.gameSetId);
            const setSnap = await getDoc(setRef);
            if (setSnap.exists()) {
              setGameSet({ id: setSnap.id, ...setSnap.data() } as GameSet);
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
  
      return unsubscribe;
    };
  
    let unsubscribe: (() => void) | undefined;
    initializeLobby().then(unsub => {
      if (unsub) unsubscribe = unsub;
    });
  
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [gameRoomId, user, loadingUser, router, toast, joinRoom, gameSet]);
  
  if (isLoading || loadingUser || !gameRoom) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 로비에 참여하는 중...</p>
      </div>
    );
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
