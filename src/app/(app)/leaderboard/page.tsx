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

const leaderboardData = [
  { rank: 1, nickname: '피치공주', level: 15, xp: 15220, avatar: 'https://picsum.photos/seed/105/100/100' },
  { rank: 2, nickname: '개발자 아빠', level: 14, xp: 14890, avatar: 'https://picsum.photos/seed/108/100/100' },
  { rank: 3, nickname: '슈퍼마리오', level: 12, xp: 12300, avatar: 'https://picsum.photos/seed/104/100/100' },
  { rank: 4, nickname: '요시', level: 11, xp: 11050, avatar: 'https://picsum.photos/seed/106/100/100' },
  { rank: 5, nickname: '키노피오', level: 10, xp: 9800, avatar: 'https://picsum.photos/seed/107/100/100' },
  { rank: 6, nickname: '역사 선생님', level: 9, xp: 8500, avatar: 'https://picsum.photos/seed/109/100/100' },
  { rank: 7, nickname: '영어 마스터', level: 8, xp: 7600, avatar: 'https://picsum.photos/seed/110/100/100' },
];

export default function LeaderboardPage() {
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-3xl">리더보드</CardTitle>
          <CardDescription>
            경험치(XP)를 기준으로 상위 플레이어들을 확인하세요.
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
              {leaderboardData.map((player) => (
                <TableRow key={player.rank} className={player.rank <= 3 ? 'bg-secondary/50' : ''}>
                  <TableCell className="font-bold text-center text-lg">
                    {player.rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : player.rank}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={player.avatar} alt={player.nickname} />
                        <AvatarFallback>{player.nickname.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{player.nickname}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">Lv. {player.level}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{player.xp.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
