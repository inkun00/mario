
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion, serverTimestamp, deleteField, deleteDoc, arrayRemove, runTransaction } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamCooperationGameRoom, TeamCooperationPlayer, User as FsUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Crown, Users, Loader2, Gamepad2, XCircle, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PixelAvatar } from '@/components/pixel-avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TeamCooperationLobbyPage() {
    const router = useRouter();
    const { id: gameRoomId } = useParams();
    const { toast } = useToast();
    const [user, loadingUser] = useAuthState(auth);
    
    const [gameRoom, setGameRoom] = useState<TeamCooperationGameRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [kickCandidate, setKickCandidate] = useState<TeamCooperationPlayer | null>(null);

    const isHost = user?.uid === gameRoom?.hostId;

    const joinRoom = useCallback(async (userToJoin: FsUser, roomRef: any) => {
        if (!gameRoomId || typeof gameRoomId !== 'string') return;
        try {
            await runTransaction(db, async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists()) throw new Error("Game room not found");
                
                const roomData = roomDoc.data() as TeamCooperationGameRoom;

                if (roomData.players && roomData.players[userToJoin.uid]) return;
                
                const newPlayer: TeamCooperationPlayer = {
                    uid: userToJoin.uid,
                    nickname: userToJoin?.displayName || `플레이어`,
                    score: 0,
                    pixelAvatar: userToJoin?.pixelAvatar,
                    isHost: false,
                    answers: [],
                };

                transaction.update(roomRef, {
                    [`players.${userToJoin.uid}`]: newPlayer,
                });
            });
        } catch (error) {
            console.error('Failed to join room:', error);
            toast({ variant: 'destructive', title: '참여 실패', description: '게임방에 참여하는 중 오류가 발생했습니다.' });
            router.push('/dashboard');
        }
    }, [gameRoomId, router, toast]);

    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || loadingUser || !user) return;
        
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoomId);
        
        const initializeLobby = async () => {
            const initialRoomSnap = await getDoc(roomRef);
            if (!initialRoomSnap.exists()) {
                toast({ variant: 'destructive', title: '오류', description: '게임방을 찾을 수 없습니다.' });
                router.push('/dashboard');
                return;
            }

            const isPlayerInRoom = !!initialRoomSnap.data().players[user.uid];
            if (!isPlayerInRoom) {
              const userSnap = await getDoc(doc(db, 'users', user.uid));
              if (userSnap.exists()) {
                await joinRoom(userSnap.data() as FsUser, roomRef);
              }
            }
        };

        initializeLobby();

        const unsubscribe = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() } as TeamCooperationGameRoom;
                if (gameRoom && user && gameRoom.players[user.uid] && !roomData.players[user.uid]) {
                    toast({ variant: "destructive", title: "방에서 내보내졌습니다." });
                    router.push('/dashboard');
                    return;
                }
                setGameRoom(roomData);
                if (roomData.status === 'playing') {
                    router.push(`/team-cooperation/${gameRoomId}`);
                }
            } else {
                toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
                router.push('/dashboard');
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [gameRoomId, user, loadingUser, router, toast, joinRoom]);

    const handleStartGame = async () => {
        if (!isHost || !gameRoom) return;
        const roomRef = doc(db, 'team-cooperation-rooms', gameRoom.id);
        try {
            await updateDoc(roomRef, { 
                status: 'playing', 
                currentQuestionIndex: 0,
                currentQuestionStartedAt: serverTimestamp(),
            });
        } catch (error) {
            toast({ variant: 'destructive', title: '오류', description: '게임 시작에 실패했습니다.' });
        }
    };
    
    const handleLeaveRoom = async () => {
        if (!user || !gameRoom) return;
        if (isHost) {
            await deleteDoc(doc(db, 'team-cooperation-rooms', gameRoom.id));
        } else {
            await updateDoc(doc(db, 'team-cooperation-rooms', gameRoom.id), {
                [`players.${user.uid}`]: deleteField(),
            });
        }
        router.push('/dashboard');
    };

    const handleKickPlayer = async () => {
        if (!isHost || !kickCandidate || !gameRoom) return;
        await updateDoc(doc(db, 'team-cooperation-rooms', gameRoom.id), {
            [`players.${kickCandidate.uid}`]: deleteField(),
        });
        setKickCandidate(null);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(gameRoomId as string).then(() => {
            toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
        });
    };

    if (isLoading || loadingUser) {
        return (
          <div className="flex flex-col items-center justify-center min-h-screen">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">팀 협력전 로비에 참여하는 중...</p>
          </div>
        );
    }
    
    if (!gameRoom) {
        return <div>로딩 중...</div>
    }

    const players = Object.values(gameRoom.players).sort(a => a.isHost ? -1 : 1);

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-4xl mx-auto">
                <CardHeader className="text-center">
                    <CardTitle className="font-headline text-3xl">{gameRoom.roomTitle}</CardTitle>
                    <CardDescription>모든 플레이어가 한 팀입니다! 모두 들어오면 호스트가 게임을 시작합니다.</CardDescription>
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
                        <ScrollArea className="h-60">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pr-4">
                                {players.map(player => (
                                    <div key={player.uid} className="group relative flex items-center gap-2 p-2 border rounded-lg bg-background">
                                        <Avatar className="w-8 h-8">
                                            {player.pixelAvatar ? <PixelAvatar pixels={JSON.parse(player.pixelAvatar)} /> : <AvatarFallback>{player.nickname.substring(0, 1)}</AvatarFallback>}
                                        </Avatar>
                                        <p className="text-sm font-medium truncate flex-1">{player.nickname}</p>
                                        {player.isHost && <Crown className="w-4 h-4 text-yellow-500" />}
                                        {isHost && !player.isHost && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setKickCandidate(player)}
                                            >
                                                <XCircle className="w-4 h-4 text-destructive" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="flex flex-col items-center gap-4 pt-4 border-t">
                        {isHost ? (
                            <Button onClick={handleStartGame} size="lg" className="font-headline text-lg">
                               <Gamepad2 className="w-5 h-5 mr-2" /> 게임 시작
                            </Button>
                        ) : (
                             <div className="text-center"><p className="text-muted-foreground">호스트가 게임을 시작하기를 기다리고 있습니다...</p></div>
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
                        <AlertDialogDescription>{kickCandidate?.nickname}님을 게임방에서 내보냅니다.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction onClick={handleKickPlayer} className="bg-destructive hover:bg-destructive/90">내보내기</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
