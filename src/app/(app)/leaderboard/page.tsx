
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db, auth } from '@/lib/firebase';
import type { User, GameSet, School } from '@/lib/types';
import { getLevelInfo } from '@/lib/level-system';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Crown, Loader2, School as SchoolIcon, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

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
    const q = query(gameSetsRef, orderBy('playCount', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSet));
}


export default function LeaderboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [leaderboardData, setLeaderboardData] = useState<User[]>([]);
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<School[]>([]);
  const [schoolPersonalLeaderboard, setSchoolPersonalLeaderboard] = useState<User[]>([]);
  const [popularGameSets, setPopularGameSets] = useState<GameSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('overall');

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        if (currentTab === 'overall') {
            if (leaderboardData.length === 0) setLeaderboardData(await getLeaderboardData());
        } else if (currentTab === 'school') {
            if (schoolLeaderboard.length === 0) {
              const schools = await getSchoolLeaderboardData();
              setSchoolLeaderboard(schools);

              if (user) {
                  const userDoc = (await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid), limit(1)))).docs[0];
                  const schoolName = userDoc?.data().schoolName;
                  if (schoolName) {
                      const userSchool = schools.find(s => s.name === schoolName);
                      setSchoolPersonalLeaderboard(userSchool ? userSchool.members : []);
                  }
              }
            }
        } else if (currentTab === 'popular-sets') {
            if (popularGameSets.length === 0) setPopularGameSets(await getPopularGameSets());
        }
        setIsLoading(false);
    };
    fetchData();
  }, [currentTab, user, leaderboardData.length, schoolLeaderboard.length, popularGameSets.length]);

  return (
    <div className="container mx-auto">
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
                            {leaderboardData.map((player, index) => {
                                const rank = index + 1;
                                const levelInfo = getLevelInfo(player.xp);
                                const displayName = player.displayName || '이름없음';
                                return (
                                <TableRow key={player.uid} className={rank <= 3 ? 'bg-secondary/50' : ''}>
                                    <TableCell className="font-bold text-center text-lg">
                                    {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                    </TableCell>
                                    <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="flex items-center justify-center bg-secondary">
                                        <span className="text-xl">{levelInfo.icon}</span>
                                        </Avatar>
                                        <span className="font-medium">{displayName}</span>
                                    </div>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">Lv. {levelInfo.level}</TableCell>
                                    <TableCell className="text-right font-bold text-primary">{player.xp.toLocaleString()}</TableCell>
                                </TableRow>
                                )
                            })}
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
                                        <TableRow key={school.name} className={rank <= 3 ? 'bg-secondary/50' : ''}>
                                            <TableCell className="font-bold text-center text-lg">
                                                {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="flex items-center justify-center bg-secondary">
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
                    {isLoading ? <LeaderboardSkeleton /> : !loadingUser && !schoolPersonalLeaderboard.length ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">
                                {user ? '소속된 학교의 랭킹 정보가 없습니다. 프로필에서 학교 정보를 업데이트해주세요.' : '로그인이 필요한 서비스입니다.'}
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
                            {schoolPersonalLeaderboard.map((player, index) => {
                                const rank = index + 1;
                                const levelInfo = getLevelInfo(player.xp);
                                const displayName = player.displayName || '이름없음';

                                return (
                                <TableRow key={player.uid} className={player.uid === user?.uid ? 'bg-primary/10' : (rank <= 3 ? 'bg-secondary/50' : '')}>
                                    <TableCell className="font-bold text-center text-lg">
                                    {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                    </TableCell>
                                    <TableCell>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="flex items-center justify-center bg-secondary">
                                        <span className="text-xl">{levelInfo.icon}</span>
                                        </Avatar>
                                        <span className="font-medium">{displayName}</span>
                                    </div>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">Lv. {levelInfo.level}</TableCell>
                                    <TableCell className="text-right font-bold text-primary">{player.xp.toLocaleString()}</TableCell>
                                </TableRow>
                                )
                            })}
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
                                    return (
                                        <TableRow key={gameSet.id} className={rank <= 3 ? 'bg-secondary/50' : ''}>
                                            <TableCell className="font-bold text-center text-lg">
                                                {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                                            </TableCell>
                                            <TableCell>
                                                 <Link href={`/dashboard?gameSetId=${gameSet.id}`} className="font-medium hover:underline flex items-center gap-2">
                                                    <BookOpen className="w-4 h-4 text-muted-foreground"/> {gameSet.title}
                                                 </Link>
                                            </TableCell>
                                            <TableCell>{gameSet.creatorNickname}</TableCell>
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
    </div>
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
