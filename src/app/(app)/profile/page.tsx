import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const achievementData = [
  { name: '사회', 맞춘문제: 40, 틀린문제: 10 },
  { name: '영어', 맞춘문제: 30, 틀린문제: 20 },
  { name: '코딩', 맞춘문제: 20, 틀린문제: 5 },
  { name: '지리', 맞춘문제: 50, 틀린문제: 8 },
];

const pieData = [
    { name: '정답', value: 140 },
    { name: '오답', value: 43 },
]
const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--destructive) / 0.5)'];

const incorrectAnswers = [
    { id: 1, questionText: '대한민국의 수도는 어디인가요?', addedAt: '2023-10-26' },
    { id: 2, questionText: 'React에서 state를 변경하는 함수는 무엇인가요?', addedAt: '2023-10-25' },
    { id: 3, questionText: '물의 화학식은 무엇인가요?', addedAt: '2023-10-24' },
]

export default function ProfilePage() {
  return (
    <div className="container mx-auto flex flex-col gap-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-primary">
              <AvatarImage src="https://picsum.photos/seed/104/100/100" />
              <AvatarFallback>슈마</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="font-headline text-3xl">슈퍼마리오</CardTitle>
              <CardDescription>학습을 즐기는 탐험가</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">Lv. 12</p>
              <p className="text-sm text-muted-foreground">레벨</p>
            </div>
            <div>
              <p className="text-2xl font-bold">12,300</p>
              <p className="text-sm text-muted-foreground">경험치 (XP)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">76.5%</p>
              <p className="text-sm text-muted-foreground">정답률</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">학습 성취도 분석</CardTitle>
          <CardDescription>과목별 성취도와 전체 정답률을 확인하세요.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-8 items-center">
          <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={achievementData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}/>
                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                    <Bar dataKey="맞춘문제" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="틀린문제" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="h-64 flex flex-col items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}/>
                    <Legend wrapperStyle={{fontSize: "12px"}}/>
                </PieChart>
             </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">오답 노트</CardTitle>
          <CardDescription>틀렸던 문제들을 다시 확인하고 복습하세요.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {incorrectAnswers.map((item, index) => (
                    <div key={item.id}>
                        <div className="flex justify-between items-start">
                           <div>
                                <p className="font-medium">{item.questionText}</p>
                                <p className="text-sm text-muted-foreground mt-1">기록일: {item.addedAt}</p>
                           </div>
                           <Button variant="secondary" size="sm">정답 확인</Button>
                        </div>
                        {index < incorrectAnswers.length -1 && <Separator className="mt-4" />}
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

    </div>
  );
}
