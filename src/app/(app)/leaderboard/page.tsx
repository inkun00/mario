
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Crown } from 'lucide-react';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import type { User } from '@/lib/types';
import { getLevelInfo } from '@/lib/level-system';

// Correctly initialize Firebase Admin SDK for server-side execution.
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

async function getLeaderboardData(): Promise<User[]> {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.orderBy('xp', 'desc').limit(50).get();
  
  if (snapshot.empty) {
    return [];
  }

  return snapshot.docs.map(doc => doc.data() as User);
}


export default async function LeaderboardPage() {
  const leaderboardData = await getLeaderboardData();

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
                        <Avatar>
                          <AvatarImage src={`https://picsum.photos/seed/${player.uid}/100/100`} alt={displayName} />
                          <AvatarFallback>{displayName.substring(0, 2)}</AvatarFallback>
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
        </CardContent>
      </Card>
    </div>
  );
}
