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
import { Input } from '@/components/ui/input';
import { Book, PlusCircle, Users, Star, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GameSet } from '@/lib/types';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


interface GameSetDocument extends GameSet {
  id: string;
}

export default function DashboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [gameSets, setGameSets] = useState<GameSetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameSet, setSelectedGameSet] = useState<GameSetDocument | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GameSetDocument | null>(null);
  const { toast } = useToast();

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

  const handleDelete = async () => {
    if (!deleteCandidate) return;

    try {
        await deleteDoc(doc(db, "game-sets", deleteCandidate.id));
        toast({
            title: "성공",
            description: "퀴즈 세트를 삭제했습니다."
        });
        setDeleteCandidate(null);
    } catch (error) {
        console.error("Error deleting document: ", error);
        toast({
            variant: "destructive",
            title: "오류",
            description: "퀴즈 세트 삭제 중 오류가 발생했습니다."
        });
    }
  };

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
        {loading || loadingUser ? (
           <p>게임 세트를 불러오는 중...</p>
        ) : gameSets.length === 0 ? (
            <p>아직 만들어진 게임 세트가 없습니다. 첫 번째 퀴즈를 만들어보세요!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gameSets.map((set) => {
              const isCreator = user && set.creatorId === user.uid;
              return (
              <Card key={set.id} className="hover:shadow-lg transition-shadow flex flex-col">
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
                <CardFooter className="mt-auto flex justify-end gap-2">
                   <Button variant="ghost" onClick={() => setSelectedGameSet(set)}>미리보기</Button>
                  {isCreator ? (
                    <>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/game-sets/edit/${set.id}`}><Pencil className="mr-2 h-4 w-4" /> 수정</Link>
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(set)}>
                        <Trash2 className="mr-2 h-4 w-4" /> 삭제
                      </Button>
                    </>
                  ) : (
                     <Button asChild>
                        <Link href={`/game-rooms/new?gameSetId=${set.id}`}><Users className="mr-2 h-4 w-4" />방 만들기</Link>
                    </Button>
                  )}
                </CardFooter>
              </Card>
            )})}
          </div>
        )}
      </div>

      {selectedGameSet && (
        <Dialog open={!!selectedGameSet} onOpenChange={(isOpen) => !isOpen && setSelectedGameSet(null)}>
          <DialogContent className="max-w-2xl">
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
                            <div className="flex justify-between items-start">
                                <p className="font-semibold text-base">질문 {index + 1}. {q.question}</p>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="flex items-center gap-1 font-semibold text-primary">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400"/>
                                        {q.points}점
                                    </span>
                                    {q.hasMysteryBox && <span className="text-accent font-semibold">미스터리</span>}
                                </div>
                            </div>

                            {q.type === 'subjective' && (
                                <p className="mt-3 text-sm text-foreground/80 bg-background/50 rounded p-2">
                                    <span className="font-medium">주관식 정답:</span> {q.answer}
                                </p>
                            )}

                            {q.type === 'multipleChoice' && q.options && (
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {q.options.map((option, optIndex) => {
                                        const isCorrect = option === q.correctAnswer;
                                        return (
                                            <div key={optIndex} className={cn("flex items-center gap-2 text-sm p-2 rounded-md", isCorrect ? "bg-primary/20 border border-primary" : "bg-background/50")}>
                                                {isCorrect && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                                                <span className={cn(isCorrect && "font-semibold")}>{option}</span>
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

      <AlertDialog open={!!deleteCandidate} onOpenChange={(isOpen) => !isOpen && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 퀴즈 세트를 삭제하면 되돌릴 수 없습니다. "{deleteCandidate?.title}" 퀴즈를 영구적으로 삭제합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
