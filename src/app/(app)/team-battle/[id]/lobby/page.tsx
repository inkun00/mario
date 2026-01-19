
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, getDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { TeamBattleGameRoom, TeamBattlePlayer, User as FsUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Copy, Crown, Users, Loader2, Gamepad2, LogOut, Shuffle, Shield } from 'lucide-react';
import { PixelAvatar } from '@/components/pixel-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function TeamBattleLobbyPage() {
    const router = useRouter();
    const { id: gameRoomId } = useParams();
    const { toast } = useToast();
    const [user, loadingUser] = useAuthState(auth);
    
    const [gameRoom, setGameRoom] = useState<TeamBattleGameRoom | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isHost = user?.uid === gameRoom?.hostId;
    const currentPlayer = user ? gameRoom?.players[user.uid] : null;

    useEffect(() => {
        if (!gameRoomId || typeof gameRoomId !== 'string' || loadingUser || !user) return;

        const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
        
        const joinRoom = async (userToJoin: FsUser) => {
             try {
                await runTransaction(db, async (transaction) => {
                    const roomDoc = await transaction.get(roomRef);
                    if (!roomDoc.exists()) throw new Error("Game room not found");
                    const roomData = roomDoc.data() as TeamBattleGameRoom;

                    if (roomData.players && roomData.players[userToJoin.uid]) return;
                    
                    const newPlayer: TeamBattlePlayer = {
                        uid: userToJoin.uid,
                        nickname: userToJoin.displayName,
                        score: 0,
                        pixelAvatar: userToJoin.pixelAvatar,
                        isHost: userToJoin.uid === roomData.hostId,
                        isEliminated: false,
                        answers: [],
                        teamId: undefined,
                    };
                    transaction.update(roomRef, { [`players.${userToJoin.uid}`]: newPlayer });
                });
            } catch (error) {
                console.error('Failed to join room:', error);
                router.push('/dashboard');
            }
        };

        const unsubscribe = onSnapshot(roomRef, async (docSnap) => {
            if (docSnap.exists()) {
                const roomData = { id: docSnap.id, ...docSnap.data() } as TeamBattleGameRoom;
                 if (gameRoom && user && gameRoom.players[user.uid] && !roomData.players[user.uid]) {
                    toast({ variant: "destructive", title: "방에서 내보내졌습니다." });
                    router.push('/dashboard');
                    return;
                }
                setGameRoom(roomData);
                 if (roomData.status === 'playing') {
                    router.push(`/team-battle/${gameRoomId}`);
                }

                // Auto-join logic
                const isPlayerInRoom = !!roomData.players[user.uid];
                 if (!isPlayerInRoom) {
                    const userSnap = await getDoc(doc(db, 'users', user.uid));
                    if (userSnap.exists()) {
                        await joinRoom(userSnap.data() as FsUser);
                    }
                }
            } else {
                toast({ variant: 'destructive', title: '방이 삭제되었습니다.' });
                router.push('/dashboard');
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [gameRoomId, user, loadingUser, router, toast]);

    const handleTeamJoin = async (teamId: 'teamA' | 'teamB') => {
        if (!user || !gameRoom || currentPlayer?.teamId === teamId) return;

        try {
            const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
            await updateDoc(roomRef, {
                [`players.${user.uid}.teamId`]: teamId
            });
        } catch (error) {
            toast({ variant: "destructive", title: "팀 참가 실패" });
        }
    };

    const handleRandomAssign = async () => {
        if (!isHost || !gameRoom) return;

        const unassignedPlayers = Object.values(gameRoom.players).filter(p => !p.isHost && !p.teamId);
        const shuffled = unassignedPlayers.sort(() => 0.5 - Math.random());
        
        const teamAPlayers = Object.values(gameRoom.players).filter(p => p.teamId === 'teamA');
        const teamBPlayers = Object.values(gameRoom.players).filter(p => p.teamId === 'teamB');

        const updates: Record<string, any> = {};
        let teamACount = teamAPlayers.length;
        let teamBCount = teamBPlayers.length;

        shuffled.forEach(player => {
            if (teamACount <= teamBCount) {
                updates[`players.${player.uid}.teamId`] = 'teamA';
                teamACount++;
            } else {
                updates[`players.${player.uid}.teamId`] = 'teamB';
                teamBCount++;
            }
        });
        
        try {
            const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
            await updateDoc(roomRef, updates);
        } catch (error) {
            toast({variant: 'destructive', title: '팀 배정 실패'});
        }
    };
    
    const handleStartGame = async () => {
        if (!isHost || !gameRoom) return;
        
        const unassignedPlayers = Object.values(gameRoom.players).filter(p => !p.isHost && !p.teamId);
        if (unassignedPlayers.length > 0 && gameRoom.teamAssignment === 'manual') {
            toast({variant: 'destructive', title: '팀 미배정', description: '모든 플레이어가 팀을 선택해야 합니다.'});
            return;
        }

        const teamAPlayers = Object.values(gameRoom.players).filter(p => p.teamId === 'teamA');
        const teamBPlayers = Object.values(gameRoom.players).filter(p => p.teamId === 'teamB');

        if (teamAPlayers.length === 0 || teamBPlayers.length === 0) {
            toast({variant: 'destructive', title: '팀 인원 부족', description: '양 팀에 최소 1명 이상의 플레이어가 필요합니다.'});
            return;
        }

        try {
            const roomRef = doc(db, 'team-battle-rooms', gameRoomId as string);
            
            const updates: Record<string, any> = {};
            const questionIndices = Array.from({ length: gameRoom.allQuestions.length }, (_, i) => i);
            
            Object.values(gameRoom.players).forEach(player => {
                if (!player.isHost) {
                    const shuffledIndices = [...questionIndices].sort(() => Math.random() - 0.5);
                    updates[`players.${player.uid}.questionOrder`] = shuffledIndices;
                    updates[`players.${player.uid}.currentQuestionIndex`] = 0;
                }
            });

            const gameStartTime = serverTimestamp();
            const gameEndTime = new Date(Date.now() + (gameRoom.gameDuration || 5) * 60 * 1000);

            await updateDoc(roomRef, { 
                ...updates,
                status: 'playing',
                gameStartedAt: gameStartTime,
                gameEndTime: gameEndTime,
            });
        } catch (error) {
            console.error("Error starting game: ", error)
            toast({ variant: 'destructive', title: '오류', description: '게임 시작에 실패했습니다.' });
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(gameRoomId as string).then(() => {
            toast({ title: '성공', description: '참여 코드가 복사되었습니다.' });
        });
    };

    const { teamAPlayers, teamBPlayers, unassignedPlayers } = useMemo(() => {
        if (!gameRoom) return { teamAPlayers: [], teamBPlayers: [], unassignedPlayers: [] };
        const players = Object.values(gameRoom.players).filter(p => !p.isHost);
        return {
            teamAPlayers: players.filter(p => p.teamId === 'teamA'),
            teamBPlayers: players.filter(p => p.teamId === 'teamB'),
            unassignedPlayers: players.filter(p => !p.teamId),
        };
    }, [gameRoom]);

    if (isLoading || loadingUser) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>;
    }
    
    if (!gameRoom) return <div>게임을 찾을 수 없습니다.</div>;

    const renderPlayerList = (players: TeamBattlePlayer[]) => (
        <ScrollArea className="h-40">
            <div className="space-y-2 pr-4">
                {players.map(player => (
                    <div key={player.uid} className="flex items-center gap-2 p-2 rounded-md bg-background">
                         <Avatar className="w-8 h-8">
                             <PixelAvatar pixels={player.pixelAvatar ? JSON.parse(player.pixelAvatar) : null} />
                             <AvatarFallback>{player.nickname.substring(0,1)}</AvatarFallback>
                         </Avatar>
                         <p className="text-sm font-medium truncate">{player.nickname}</p>
                    </div>
                ))}
            </div>
        </ScrollArea>
    );

    return (
        <div className="container mx-auto py-8">
            <Card className="max-w-6xl mx-auto">
                 <CardHeader className="text-center">
                    <CardTitle className="font-headline text-3xl">{gameRoom.roomTitle}</CardTitle>
                    <CardDescription>팀을 선택하거나, 호스트가 팀을 배정할 때까지 기다려주세요.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="bg-secondary/50 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                       <div className="text-center md:text-left">
                            <p className="text-sm font-medium text-muted-foreground">참여 코드</p>
                            <p className="text-2xl font-bold font-mono tracking-widest">{gameRoom.id}</p>
                       </div>
                        <Button onClick={copyToClipboard} variant="outline"><Copy className="w-4 h-4 mr-2" />코드 복사</Button>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Team A */}
                        <Card className="bg-red-100/30 dark:bg-red-900/30 border-red-500">
                            <CardHeader>
                                <CardTitle className="text-red-600 dark:text-red-400">레드 팀 ({teamAPlayers.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {renderPlayerList(teamAPlayers)}
                            </CardContent>
                            {gameRoom.teamAssignment === 'manual' && !isHost && !currentPlayer?.teamId && (
                                <CardFooter>
                                    <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleTeamJoin('teamA')}>레드 팀 참가</Button>
                                </CardFooter>
                            )}
                        </Card>

                        {/* Team B */}
                        <Card className="bg-blue-100/30 dark:bg-blue-900/30 border-blue-500">
                            <CardHeader>
                                <CardTitle className="text-blue-600 dark:text-blue-400">블루 팀 ({teamBPlayers.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {renderPlayerList(teamBPlayers)}
                            </CardContent>
                             {gameRoom.teamAssignment === 'manual' && !isHost && !currentPlayer?.teamId && (
                                <CardFooter>
                                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleTeamJoin('teamB')}>블루 팀 참가</Button>
                                </CardFooter>
                            )}
                        </Card>
                    </div>

                    {unassignedPlayers.length > 0 && (
                        <Card>
                             <CardHeader>
                                <CardTitle className="text-lg">팀 미배정 플레이어 ({unassignedPlayers.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                               {renderPlayerList(unassignedPlayers)}
                            </CardContent>
                        </Card>
                    )}

                    <div className="flex flex-col items-center gap-4 pt-4 border-t">
                        {isHost ? (
                            <div className="flex gap-2">
                                {gameRoom.teamAssignment === 'random' && (
                                    <Button onClick={handleRandomAssign} variant="outline"><Shuffle className="w-4 h-4 mr-2"/>랜덤 배정</Button>
                                )}
                                <Button onClick={handleStartGame} size="lg" className="font-headline text-lg">
                                   <Gamepad2 className="w-5 h-5 mr-2" /> 게임 시작
                                </Button>
                            </div>
                        ) : (
                             <div className="text-center"><p className="text-muted-foreground">호스트가 게임을 시작하기를 기다리고 있습니다...</p></div>
                        )}
                         <Button onClick={() => router.push('/dashboard')} variant="destructive" size="sm">
                            <LogOut className="w-4 h-4 mr-2" /> 방 나가기
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
