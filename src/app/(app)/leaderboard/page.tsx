
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, auth } from '@/lib/firebase';
import type { User, GameSet, School, Question, GameRoom } from '@/lib/types';
import { getLevelInfo } from '@/lib/level-system';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import { Crown, Loader2, School as SchoolIcon, BookOpen, Users, HelpCircle, Star, Sparkles, Tv, Smartphone } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';


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

const getStarRating = (score?: number): { stars: number, color: string } => {
  if (score === undefined || score === null) return { stars: 0, color: 'text-muted-foreground' };
  if (score >= 81) return { stars: 5, color: 'text-yellow-400' };
  if (score >= 61) return { stars: 4, color: 'text-yellow-400' };
  if (score >= 41) return { stars: 3, color: 'text-yellow-400' };
  if (score >= 21) return { stars: 2, color: 'text-yellow-400' };
  if (score > 0) return { stars: 1, color: 'text-yellow-400' };
  return { stars: 0, color: 'text-muted-foreground' };
};


const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
};

const ITEMS_PER_PAGE = 10;

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
  const [gameCreationCandidate, setGameCreationCandidate] = useState<GameSet | null>(null);

  const [overallCurrentPage, setOverallCurrentPage] = useState(1);
  const [schoolCurrentPage, setSchoolCurrentPage] = useState(1);
  const [schoolPersonalCurrentPage, setSchoolPersonalCurrentPage] = useState(1);
  const [popularSetsCurrentPage, setPopularSetsCurrentPage] = useState(1);

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
  
  useEffect(() => {
    setSchoolPersonalCurrentPage(1);
  }, [selectedSchool]);

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
  
  const PaginatedContent = ({ data, renderRow, page, setPage, emptyMessage }: { data: any[], renderRow: (item: any, rank: number) => JSX.Element, page: number, setPage: (page: number) => void, emptyMessage: string }) => {
    const totalPages = Math.ceil(data.length / ITEMS_PER_PAGE);
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = page * ITEMS_PER_PAGE;
    const currentItems = data.slice(startIndex, endIndex);

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
        }
    };

    return (
        <>
            {currentItems.length > 0 ? (
                <>
                    <TableBody>
                        {currentItems.map((item, index) => renderRow(item, startIndex + index + 1))}
                    </TableBody>
                    {totalPages > 1 && (
                        <caption className="mt-4">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(page - 1); }} />
                                    </PaginationItem>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                        <PaginationItem key={p}>
                                            <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(p); }} isActive={page === p}>
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    <PaginationItem>
                                        <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(page + 1); }} />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </caption>
                    )}
                </>
            ) : (
                <caption className="text-center py-8 text-muted-foreground">{emptyMessage}</caption>
            )}
        </>
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
                                <PaginatedContent 
                                    data={leaderboardData}
                                    renderRow={renderPlayerRow}
                                    page={overallCurrentPage}
                                    setPage={setOverallCurrentPage}
                                    emptyMessage="랭킹 데이터가 없습니다."
                                />
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
                                <PaginatedContent 
                                    data={schoolLeaderboard}
                                    renderRow={(school, rank) => (
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
                                    )}
                                    page={schoolCurrentPage}
                                    setPage={setSchoolCurrentPage}
                                    emptyMessage="학교 랭킹 데이터가 없습니다."
                                />
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
                              <PaginatedContent 
                                    data={schoolPersonalLeaderboard}
                                    renderRow={renderPlayerRow}
                                    page={schoolPersonalCurrentPage}
                                    setPage={setSchoolPersonalCurrentPage}
                                    emptyMessage={selectedSchool ? '해당 학교의 랭킹 정보가 없습니다.' : '학교를 선택하여 순위를 확인하세요.'}
                                />
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
                                        <TableHead className="text-center">활용 횟수</TableHead>
                                        <TableHead className="text-right w-[120px]">작업</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <PaginatedContent 
                                    data={popularGameSets}
                                    renderRow={(gameSet, rank) => {
                                        const isClickable = gameSet.creatorId !== user?.uid;
                                        return (
                                            <TableRow key={gameSet.id} className={rank <= 3 ? 'bg-secondary' : ''}>
                                                <TableCell className="font-bold text-center text-lg">
                                                    {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                                </TableCell>
                                                <TableCell>
                                                    <span 
                                                      className="font-medium hover:underline flex items-center gap-2 cursor-pointer"
                                                      onClick={() => setSelectedGameSetForPreview(gameSet)}
                                                    >
                                                        <BookOpen className="w-4 h-4 text-muted-foreground"/> {gameSet.title}
                                                    </span>
                                                </TableCell>
                                                <TableCell 
                                                    className={`font-medium ${isClickable ? 'cursor-pointer hover:underline' : ''}`}
                                                    onClick={isClickable ? () => handleUserClick(leaderboardData.find(p => p.uid === gameSet.creatorId) || { uid: gameSet.creatorId, displayName: gameSet.creatorNickname } as User) : undefined}
                                                >
                                                    {gameSet.creatorNickname}
                                                </TableCell>
                                                <TableCell className="text-center">{gameSet.questions.length}개</TableCell>
                                                <TableCell className="text-center font-bold text-primary">{gameSet.playCount || 0}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" onClick={() => setGameCreationCandidate(gameSet)}>
                                                        <Users className="mr-2 h-4 w-4"/>방 만들기
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    }}
                                    page={popularSetsCurrentPage}
                                    setPage={setPopularSetsCurrentPage}
                                    emptyMessage="인기 퀴즈 데이터가 없습니다."
                                />
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
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <PixelAvatar pixels={selectedUser?.pixelAvatar ? JSON.parse(selectedUser.pixelAvatar) : null} />
              </Avatar>
              <div>
                <DialogTitle className="font-headline text-2xl">{selectedUser?.displayName}님이 만든 퀴즈</DialogTitle>
                <DialogDescription>이 사용자가 만들어서 공개한 퀴즈 목록입니다.</DialogDescription>
              </div>
            </div>
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
                    userGameSets.map(set => {
                      const { stars, color } = getStarRating(set.evaluationScore);
                      return (
                        <Card key={set.id}>
                            <CardContent className="p-4 flex items-center justify-between gap-2">
                                <div className="flex-grow">
                                    <h4 className="font-semibold">{set.title}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {[set.grade, set.semester, set.subject].filter(Boolean).join(' / ')}
                                        {' · '}
                                        {set.questions.length} 문제
                                        {' · '}
                                        활용 {set.playCount || 0}회
                                    </p>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className={cn("flex items-center gap-1 mt-1", color)}>
                                            <Sparkles className="h-4 w-4" />
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star key={i} className={cn("h-4 w-4", i < stars ? "fill-current" : "text-gray-300")} />
                                            ))}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>AI 평가 점수: {set.evaluationScore ?? '미평가'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                  <Button variant="secondary" size="sm" onClick={() => setSelectedGameSetForPreview(set)}>미리보기</Button>
                                  <Button asChild size="sm" onClick={() => setGameCreationCandidate(set)}>
                                      <span className="flex items-center cursor-pointer">
                                        <Users className="mr-2 h-4 w-4" />방 만들기
                                      </span>
                                  </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )})
                )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
      
      {selectedGameSetForPreview && (
        <Dialog open={!!selectedGameSetForPreview} onOpenChange={(isOpen) => !isOpen && setSelectedGameSetForPreview(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <DialogTitle className="font-headline text-2xl">{selectedGameSetForPreview.title}</DialogTitle>
                        <DialogDescription>
                           {[selectedGameSetForPreview.grade, selectedGameSetForPreview.semester, selectedGameSetForPreview.subject, selectedGameSetForPreview.unit].filter(Boolean).join(' / ')}
                           {' · '}
                          총 {selectedGameSetForPreview.questions.length}개의 질문이 있습니다.
                        </DialogDescription>
                    </div>
                    {(selectedGameSetForPreview.evaluationScore !== undefined && selectedGameSetForPreview.evaluationScore !== null) && (() => {
                        const { stars, color } = getStarRating(selectedGameSetForPreview.evaluationScore);
                        return (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex flex-col items-end gap-1">
                                            <div className={cn("flex items-center gap-1", color)}>
                                                <Sparkles className="h-4 w-4" />
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <Star key={i} className={cn("h-4 w-4", i < stars ? "fill-current" : "text-gray-300")} />
                                                ))}
                                            </div>
                                            <span className="text-xs text-muted-foreground">AI 평가 점수: {selectedGameSetForPreview.evaluationScore}</span>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>AI 평가 점수: {selectedGameSetForPreview.evaluationScore ?? '미평가'}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        );
                    })()}
                </div>
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
                                    <Image src={encodeURI(q.imageUrl)} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" />
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

      <AlertDialog open={!!gameCreationCandidate} onOpenChange={(isOpen) => !isOpen && setGameCreationCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>어떤 방식으로 플레이할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              친구들과 함께 플레이할 방식을 선택해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                  <Link href={`/game-rooms/new?gameSetId=${gameCreationCandidate?.id}&joinType=local`}>
                      <Tv className="w-8 h-8"/>
                      <span className="font-semibold">한 기기로 여러 명이 플레이</span>
                  </Link>
              </Button>
              <Button variant="outline" className="h-24 flex-col gap-2" asChild>
                   <Link href={`/game-rooms/new?gameSetId=${gameCreationCandidate?.id}&joinType=remote`}>
                      <Smartphone className="w-8 h-8"/>
                      <span className="font-semibold">여러 기기로 플레이</span>
                  </Link>
              </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
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
