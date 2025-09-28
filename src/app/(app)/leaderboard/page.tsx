
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
import { db } from '@/lib/firebase';
import type { User } from '@/lib/types';
import { getLevelInfo } from '@/lib/level-system';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { Crown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';


async function getLeaderboardData(): Promise<User[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('xp', 'desc'), limit(100));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    return [];
  }

  const allUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));

  // Filter out duplicates, keeping the one with the highest XP for each displayName
  const uniqueUsers: { [key: string]: User } = {};
  for (const user of allUsers) {
    const displayName = user.displayName;
    if (!uniqueUsers[displayName] || user.xp > uniqueUsers[displayName].xp) {
        uniqueUsers[displayName] = user;
    }
  }

  // Convert back to array and sort by XP again, then take top 50
  return Object.values(uniqueUsers)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 50);
}


export default function LeaderboardPage() {
  const [leaderboardData, setLeaderboardData] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getLeaderboardData().then(data => {
      setLeaderboardData(data);
      setIsLoading(false);
    });
  }, []);

  return (
    <div className="container mx-auto">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">리더보드</CardTitle>
          <CardDescription>
            경험치(XP)를 기준으로 상위 50명의 플레이어를 확인하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="space-y-2">
                {Array.from({length: 10}).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-2">
                        <Skeleton className="h-6 w-6" />
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-6 flex-grow" />
                    </div>
                ))}
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
        </CardContent>
      </Card>
    </div>
  );
}
