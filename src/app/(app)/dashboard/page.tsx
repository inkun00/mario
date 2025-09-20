'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Book, PlusCircle, Users, Star } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GameSet } from '@/lib/types';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

interface GameSetDocument extends Omit<GameSet, 'questions'> {
  id: string;
  questions: { question: string; answer: string; points: number; hasMysteryBox: boolean }[];
  creatorNickname: string;
}

export default function DashboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [gameSets, setGameSets] = useState<GameSetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameSet, setSelectedGameSet] = useState<GameSetDocument | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'game-sets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const sets: GameSetDocument[] = [];
      querySnapshot.forEach((doc) => {
        sets.push({ id: doc.id, ...doc.data() } as GameSetDocument);
      });
      setGameSets(sets);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">안녕하세요, {user?.displayName || '게스트'}님!</h1>
        <p className="text-muted-foreground mt-1">오늘도 즐거운 학습을 시작해볼까요?</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline">게임 참여하기</CardTitle>
            <CardDescription>참여 코드를 입력하여 친구의 게임에 참여하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input placeholder="참여 코드 입력" />
              <Button>참여</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
           <CardHeader>
            <CardTitle className="font-headline">새로운 게임 시작하기</CardTitle>
            <CardDescription>원하는 게임 세트를 선택하여 새로운 게임방을 만드세요.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild className="w-full md:w-auto">
                <Link href="/game-sets/create"><PlusCircle className="mr-2 h-4 w-4"/>새로운 퀴즈 세트 만들기</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-bold font-headline mb-4">게임 세트 둘러보기</h2>
        {loading ? (
           <p>게임 세트를 불러오는 중...</p>
        ) : gameSets.length === 0 ? (
            <p>아직 만들어진 게임 세트가 없습니다. 첫 번째 퀴즈를 만들어보세요!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gameSets.map((set) => (
              <Card key={set.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                      <div>
                          <CardTitle className="font-headline text-lg">{set.title}</CardTitle>
                          <CardDescription className="mt-1">By {set.creatorNickname}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Book className="h-4 w-4" />
                          <span>{set.questions.length} 문제</span>
                      </div>
                  </div>
                </CardHeader>
                <CardFooter className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setSelectedGameSet(set)}>미리보기</Button>
                  <Button asChild>
                      <Link href={`/game-rooms/new?gameSetId=${set.id}`}><Users className="mr-2 h-4 w-4" />방 만들기</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {selectedGameSet && (
        <Dialog open={!!selectedGameSet} onOpenChange={(isOpen) => !isOpen && setSelectedGameSet(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">{selectedGameSet.title}</DialogTitle>
              <DialogDescription>
                총 {selectedGameSet.questions.length}개의 질문이 있습니다.
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96 pr-6">
                <div className="space-y-4">
                    {selectedGameSet.questions.map((q, index) => (
                        <div key={index} className="p-4 rounded-md border bg-secondary/30">
                            <div className="flex justify-between items-center">
                                <p className="font-semibold">질문 {index + 1}</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="flex items-center gap-1 font-semibold text-primary">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                                        {q.points}점
                                    </span>
                                    {q.hasMysteryBox && <span className="text-accent font-semibold">미스터리</span>}
                                </div>
                            </div>
                            <p className="mt-2 text-foreground/90">{q.question}</p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
