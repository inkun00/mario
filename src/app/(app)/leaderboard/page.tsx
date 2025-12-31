
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, auth } from '@/lib/firebase';
import type { User, GameSet, School, Question } from '@/lib/types';
import { getLevelInfo } from '@/lib/level-system';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Crown, Loader2, School as SchoolIcon, BookOpen, Users, HelpCircle, Star } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Combobox } from '@/components/ui/combobox';
import { MotionDiv } from '@/components/motion-div';
import { Button } from '@/components/ui/button';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';

async function getLeaderboardData(): Promise<User[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('xp', 'desc'), limit(100));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) return [];

  const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

  const uniqueUsers: { [key: string]: User } = {};
  for (const user of allUsers) {
    const displayName = user.displayName;
    if (!uniqueUsers[displayName] || user.xp > uniqueUsers[displayName].xp) {
        uniqueUsers[displayName] = user;
    }
  }

  return Object.values(uniqueUsers)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 50);
}

async function getSchoolLeaderboardData(): Promise<School[]> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('xp', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    const schools: { [key: string]: { totalXp: number; memberCount: number; members: User[] } } = {};
    snapshot.docs.forEach(doc => {
        const user = doc.data() as User;
        if (user.schoolName) {
            if (!schools[user.schoolName]) {
                schools[user.schoolName] = { totalXp: 0, memberCount: 0, members: [] };
            }
            schools[user.schoolName].totalXp += user.xp;
            schools[user.schoolName].memberCount++;
            schools[user.schoolName].members.push(user);
        }
    });

    return Object.entries(schools)
        .map(([name, data]) => ({
            name,
            totalXp: data.totalXp,
            memberCount: data.memberCount,
            members: data.members.sort((a, b) => b.xp - a.xp),
        }))
        .sort((a, b) => b.totalXp - a.totalXp)
        .slice(0, 50);
}

async function getPopularGameSets(): Promise<GameSet[]> {
    const gameSetsRef = collection(db, 'game-sets');
    // 복합 색인 없이 쿼리하기 위해 where 조건을 제거하고 클라이언트에서 필터링
    const q = query(gameSetsRef, orderBy('playCount', 'desc'), limit(200)); // 더 많이 가져와서 필터링
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [];

    const allSets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSet));

    // 클라이언트 측에서 isPublic 필터링 및 50개로 제한
    return allSets.filter(set => set.isPublic === true).slice(0, 50);
}

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

export default function LeaderboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [leaderboardData, setLeaderboardData] = useState<User[]>([]);
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<School[]>([]);
  const [popularGameSets, setPopularGameSets] = useState<GameSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('overall');
  const [selectedSchool, setSelectedSchool] = useState('');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userGameSets, setUserGameSets] = useState<GameSet[]>([]);
  const [isUserSetsLoading, setIsUserSetsLoading] = useState(false);
  const [selectedGameSetForPreview, setSelectedGameSetForPreview] = useState<GameSet | null>(null);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        if (currentTab === 'overall') {
            if (leaderboardData.length === 0) setLeaderboardData(await getLeaderboardData());
        } else if (currentTab === 'school' || currentTab === 'school-personal') {
            if (schoolLeaderboard.length === 0) {
              const schools = await getSchoolLeaderboardData();
              setSchoolLeaderboard(schools);

              if (user && !selectedSchool) {
                  const userDocQuery = query(collection(db, 'users'), where('uid', '==', user.uid), limit(1));
                  const userDocSnapshot = await getDocs(userDocQuery);
                  if (!userDocSnapshot.empty) {
                      const userDoc = userDocSnapshot.docs[0];
                      const schoolName = userDoc?.data().schoolName;
                      if (schoolName) {
                          setSelectedSchool(schoolName);
                      }
                  }
              }
            }
        } else if (currentTab === 'popular-sets') {
            if (popularGameSets.length === 0) setPopularGameSets(await getPopularGameSets());
        }
        setIsLoading(false);
    };
    fetchData();
  }, [currentTab, user, leaderboardData.length, schoolLeaderboard.length, popularGameSets.length, selectedSchool]);

  const schoolPersonalLeaderboard = useMemo(() => {
      if (!selectedSchool) return [];
      const school = schoolLeaderboard.find(s => s.name === selectedSchool);
      return school ? school.members : [];
  }, [selectedSchool, schoolLeaderboard]);

  const schoolOptions = useMemo(() => {
      return schoolLeaderboard.map(school => ({
          value: school.name,
          label: school.name,
      }));
  }, [schoolLeaderboard]);

  const handleUserClick = async (player: User) => {
    setSelectedUser(player);
    setIsUserSetsLoading(true);
    setUserGameSets([]);
    
    const setsQuery = query(
      collection(db, 'game-sets'), 
      where('creatorId', '==', player.uid), 
      where('isPublic', '==', true)
    );
    const snapshot = await getDocs(setsQuery);
    
    const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSet));
    
    // Sort on the client-side
    const sortedSets = sets.sort((a, b) => (b.playCount || 0) - (a.playCount || 0));

    setUserGameSets(sortedSets);
    setIsUserSetsLoading(false);
  };

  const renderPlayerRow = (player: User, rank: number) => {
    const levelInfo = getLevelInfo(player.xp);
    const displayName = player.displayName || '이름없음';
    const isClickable = player.uid !== user?.uid;
    let pixelAvatarData = null;
    if (player.pixelAvatar) {
        try {
            pixelAvatarData = JSON.parse(player.pixelAvatar);
        } catch(e) {
            console.error("Error parsing pixel avatar in leaderboard", e);
        }
    }
    
    return (
      <TableRow key={player.uid} className={player.uid === user?.uid ? 'bg-primary/10' : (rank <= 3 ? 'bg-secondary' : '')}>
        <TableCell className="font-bold text-center text-lg">
          {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="flex items-center justify-center bg-muted h-10 w-10">
                {pixelAvatarData ? (
                  <PixelAvatar pixels={pixelAvatarData} />
                ) : (
                  <AvatarFallback>{displayName.substring(0, 2)}</AvatarFallback>
                )}
            </Avatar>
            <span
              className={`font-medium ${isClickable ? 'cursor-pointer hover:underline' : ''}`}
              onClick={isClickable ? () => handleUserClick(player) : undefined}
            >
              {displayName}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-center font-medium">Lv. {levelInfo.level}</TableCell>
        <TableCell className="text-right font-bold text-primary">{player.xp.toLocaleString()}</TableCell>
      </TableRow>
    );
  };

  return (
    <>
      <div className="container mx-auto">
        <MotionDiv
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="font-headline text-3xl">리더보드</CardTitle>
              <CardDescription>
                다양한 순위를 확인하고 학습에 대한 동기를 부여받으세요!
              </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                        <TabsTrigger value="overall">전체 순위</TabsTrigger>
                        <TabsTrigger value="school">학교 순위</TabsTrigger>
                        <TabsTrigger value="school-personal">학교 내 개인 순위</TabsTrigger>
                        <TabsTrigger value="popular-sets">인기 퀴즈</TabsTrigger>
                    </TabsList>
                    <TabsContent value="overall" className="mt-4">
                        {isLoading ? <LeaderboardSkeleton /> : (
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px] text-center">순위</TableHead>
                                    <TableHead>닉네임</TableHead>
                                    <TableHead className="text-center">레벨</TableHead>
                                    <TableHead className="text-right">경험치 (XP)</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {leaderboardData.map((player, index) => renderPlayerRow(player, index + 1))}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>
                    <TabsContent value="school" className="mt-4">
                        {isLoading ? <LeaderboardSkeleton /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px] text-center">순위</TableHead>
                                        <TableHead>학교명</TableHead>
                                        <TableHead className="text-center">참여인원</TableHead>
                                        <TableHead className="text-right">총 경험치 (XP)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schoolLeaderboard.map((school, index) => {
                                        const rank = index + 1;
                                        return (
                                            <TableRow key={school.name} className={rank <= 3 ? 'bg-secondary' : ''}>
                                                <TableCell className="font-bold text-center text-lg">
                                                    {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="flex items-center justify-center bg-muted">
                                                            <SchoolIcon className="w-5 h-5 text-muted-foreground" />
                                                        </Avatar>
                                                        <span className="font-medium">{school.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">{school.memberCount}명</TableCell>
                                                <TableCell className="text-right font-bold text-primary">{school.totalXp.toLocaleString()}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>
                    <TabsContent value="school-personal" className="mt-4">
                        <div className="mb-4">
                            <Combobox
                                options={schoolOptions}
                                value={selectedSchool}
                                onValueChange={setSelectedSchool}
                                placeholder="학교 선택..."
                                searchPlaceholder="학교 검색..."
                                notFoundMessage="해당 학교를 찾을 수 없습니다."
                            />
                        </div>
                        {isLoading ? <LeaderboardSkeleton /> : !schoolPersonalLeaderboard.length ? (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">
                                    {selectedSchool ? '해당 학교의 랭킹 정보가 없습니다.' : '학교를 선택하여 순위를 확인하세요.'}
                                </p>
                            </div>
                        ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px] text-center">순위</TableHead>
                                    <TableHead>닉네임</TableHead>
                                    <TableHead className="text-center">레벨</TableHead>
                                    <TableHead className="text-right">경험치 (XP)</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {schoolPersonalLeaderboard.map((player, index) => renderPlayerRow(player, index + 1))}
                              </TableBody>
                            </Table>
                        )}
                    </TabsContent>
                    <TabsContent value="popular-sets" className="mt-4">
                        {isLoading ? <LeaderboardSkeleton /> : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px] text-center">순위</TableHead>
                                        <TableHead>퀴즈 제목</TableHead>
                                        <TableHead>제작자</TableHead>
                                        <TableHead className="text-center">문제 수</TableHead>
                                        <TableHead className="text-right">활용 횟수</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {popularGameSets.map((gameSet, index) => {
                                        const rank = index + 1;
                                        const isClickable = gameSet.creatorId !== user?.uid;
                                        return (
                                            <TableRow key={gameSet.id} className={rank <= 3 ? 'bg-secondary' : ''}>
                                                <TableCell className="font-bold text-center text-lg">
                                                    {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/dashboard?gameSetId=${gameSet.id}`} className="font-medium hover:underline flex items-center gap-2">
                                                        <BookOpen className="w-4 h-4 text-muted-foreground"/> {gameSet.title}
                                                    </Link>
                                                </TableCell>
                                                <TableCell 
                                                    className={`font-medium ${isClickable ? 'cursor-pointer hover:underline' : ''}`}
                                                    onClick={isClickable ? () => handleUserClick(leaderboardData.find(p => p.uid === gameSet.creatorId) || { uid: gameSet.creatorId, displayName: gameSet.creatorNickname } as User) : undefined}
                                                >
                                                    {gameSet.creatorNickname}
                                                </TableCell>
                                                <TableCell className="text-center">{gameSet.questions.length}개</TableCell>
                                                <TableCell className="text-right font-bold text-primary">{gameSet.playCount || 0}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
          </Card>
        </MotionDiv>
      </div>

      <Dialog open={!!selectedUser} onOpenChange={(isOpen) => !isOpen && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-headline text-2xl">{selectedUser?.displayName}님이 만든 퀴즈</DialogTitle>
            <DialogDescription>이 사용자가 만들어서 공개한 퀴즈 목록입니다.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4 py-4">
                {isUserSetsLoading ? (
                    <div className="flex items-center justify-center h-48">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : userGameSets.length === 0 ? (
                    <div className="text-center text-muted-foreground py-12">
                        공개된 퀴즈가 없습니다.
                    </div>
                ) : (
                    userGameSets.map(set => (
                        <Card key={set.id}>
                            <CardContent className="p-4 flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold">{set.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {[set.grade, set.semester, set.subject].filter(Boolean).join(' / ')}
                                        {' · '}
                                        {set.questions.length} 문제
                                        {' · '}
                                        활용 {set.playCount || 0}회
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button variant="secondary" size="sm" onClick={() => setSelectedGameSetForPreview(set)}>미리보기</Button>
                                  <Button asChild size="sm">
                                      <Link href={`/game-rooms/new?gameSetId=${set.id}`}>
                                          <Users className="mr-2 h-4 w-4" />방 만들기
                                      </Link>
                                  </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {selectedGameSetForPreview && (
        <Dialog open={!!selectedGameSetForPreview} onOpenChange={(isOpen) => !isOpen && setSelectedGameSetForPreview(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">{selectedGameSetForPreview.title}</DialogTitle>
              <DialogDescription>
                 {[selectedGameSetForPreview.grade, selectedGameSetForPreview.semester, selectedGameSetForPreview.subject, selectedGameSetForPreview.unit].filter(Boolean).join(' / ')}
                 {' · '}
                총 {selectedGameSetForPreview.questions.length}개의 질문이 있습니다.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96 pr-6">
                <div className="space-y-4">
                    {selectedGameSetForPreview.questions.map((q, index) => (
                        <div key={index} className="p-4 rounded-md border bg-muted/50">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-base whitespace-pre-wrap">{`질문 ${index + 1}. ${q.question}`}</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="flex items-center gap-1 font-semibold text-primary">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                                        {q.points === -1 ? '랜덤' : `${q.points}점`}
                                    </span>
                                    {q.points === -1 && (
                                      <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>10-50점 사이의 랜덤 점수가 부여됩니다.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                </div>
                            </div>
                            
                            {q.imageUrl && (
                                <div className="mt-2 relative aspect-video">
                                    <Image src={encodeURI(q.imageUrl)} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" unoptimized={true} />
                                </div>
                            )}

                            {q.type === 'multipleChoice' && q.options && (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {q.options.map((option, optIndex) => {
                                        return (
                                            <div key={optIndex} className="flex items-center gap-2 text-sm p-2 rounded-md bg-background/50">
                                                <span>{option}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function LeaderboardSkeleton() {
    return (
        <div className="space-y-2 mt-4">
            {Array.from({length: 10}).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-2">
                    <Skeleton className="h-6 w-6" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-6 flex-grow" />
                </div>
            ))}
        </div>
    )
}

    