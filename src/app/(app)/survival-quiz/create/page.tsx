'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import type { GameSet, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Swords, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SurvivalGameSet = GameSet & { isSelected?: boolean };

export default function CreateSurvivalQuizPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [gameSets, setGameSets] = useState<SurvivalGameSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const [roomTitle, setRoomTitle] = useState('');
  const [participationScope, setParticipationScope] = useState<'class' | 'public'>('class');
  const [selectedSets, setSelectedSets] = useState<Record<string, boolean>>({});
  const [previewGameSet, setPreviewGameSet] = useState<GameSet | null>(null);

  // Fetch user data to check for teacher role
  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data() as User;
          setUserData(data);
          if (data.role !== 'teacher') {
            toast({ variant: 'destructive', title: '권한 없음', description: '교사만 서바이벌 퀴즈를 만들 수 있습니다.' });
            router.push('/dashboard');
          }
        }
      });
      return () => unsub();
    } else if (!loadingUser) {
        router.push('/login');
    }
  }, [user, loadingUser, router, toast]);

  // Fetch game sets
  useEffect(() => {
    if (userData?.role !== 'teacher' || !user) return;

    const fetchGameSets = async () => {
      setIsLoading(true);
      try {
        const publicSetsQuery = query(collection(db, 'game-sets'), where('isPublic', '==', true));
        const mySetsQuery = query(collection(db, 'game-sets'), where('creatorId', '==', user.uid));

        const [publicSetsSnapshot, mySetsSnapshot] = await Promise.all([
          getDocs(publicSetsQuery),
          getDocs(mySetsQuery),
        ]);

        const combinedSets: Record<string, SurvivalGameSet> = {};

        publicSetsSnapshot.docs.forEach(doc => {
            combinedSets[doc.id] = { id: doc.id, ...doc.data() } as SurvivalGameSet;
        });

        mySetsSnapshot.docs.forEach(doc => {
            combinedSets[doc.id] = { id: doc.id, ...doc.data() } as SurvivalGameSet;
        });
        
        const sortedSets = Object.values(combinedSets).sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        setGameSets(sortedSets);
      } catch (error) {
        console.error("Error fetching game sets:", error);
        toast({ variant: 'destructive', title: '오류', description: '퀴즈 세트를 불러오는 중 오류가 발생했습니다.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameSets();
  }, [userData, user, toast]);

  const handleSetSelection = (setId: string, isSelected: boolean) => {
    setSelectedSets(prev => ({ ...prev, [setId]: isSelected }));
  };
  
  const handleCreateSurvivalQuiz = () => {
    const selectedIds = Object.keys(selectedSets).filter(id => selectedSets[id]);
    
    if (!roomTitle.trim()) {
        toast({ variant: 'destructive', title: '오류', description: '방 제목을 입력해주세요.' });
        return;
    }
    if (selectedIds.length === 0) {
        toast({ variant: 'destructive', title: '오류', description: '하나 이상의 퀴즈 세트를 선택해주세요.' });
        return;
    }

    console.log({
        title: roomTitle,
        scope: participationScope,
        gameSetIds: selectedIds,
    });

    toast({ title: '구현 예정', description: '서바이벌 퀴즈방 생성 로직은 아직 구현되지 않았습니다.' });
  };

  if (isLoading || loadingUser) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">페이지를 불러오는 중...</p>
      </div>
    );
  }
  
  if (userData?.role !== 'teacher') {
    return (
        <div className="container mx-auto py-8">
            <Card className="text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2"><ShieldAlert className="text-destructive"/>접근 권한 없음</CardTitle>
                    <CardDescription>
                    이 페이지는 교사 계정만 접근할 수 있습니다.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  return (
    <>
    <div className="container mx-auto py-8 max-w-4xl">
        <Card>
            <CardHeader>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                    <Swords className="text-primary"/>
                    서바이벌 퀴즈방 만들기
                </CardTitle>
                <CardDescription>
                    여러 퀴즈 세트를 조합하여 대규모 서바이벌 퀴즈를 만듭니다. 최후의 1인이 될 때까지 도전하세요!
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-2">
                    <Label htmlFor="room-title" className="text-lg font-semibold">방 제목</Label>
                    <Input 
                        id="room-title"
                        placeholder="예: 제 1회 에듀칩 서바이벌 퀴즈쇼"
                        value={roomTitle}
                        onChange={(e) => setRoomTitle(e.target.value)}
                        className="text-base"
                    />
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">참여 범위 설정</h3>
                     <RadioGroup value={participationScope} onValueChange={(val: 'class' | 'public') => setParticipationScope(val)} className="flex flex-col sm:flex-row gap-4">
                        <Label htmlFor="scope-class" className="flex items-center gap-2 p-4 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                            <RadioGroupItem value="class" id="scope-class" />
                            <div>
                                <p className="font-semibold">우리 학급 전용</p>
                                <p className="text-sm text-muted-foreground">선생님의 학급에 소속된 학생들만 참여할 수 있습니다.</p>
                            </div>
                        </Label>
                        <Label htmlFor="scope-public" className="flex items-center gap-2 p-4 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                            <RadioGroupItem value="public" id="scope-public" />
                             <div>
                                <p className="font-semibold">공개</p>
                                <p className="text-sm text-muted-foreground">다른 학급 학생들도 참여 코드를 통해 참여할 수 있습니다.</p>
                            </div>
                        </Label>
                    </RadioGroup>
                </div>
                
                 <div className="space-y-4">
                    <h3 className="text-lg font-semibold">게임 모드 선택 (구현 예정)</h3>
                    <div className="p-8 border-2 border-dashed rounded-lg text-center text-muted-foreground">
                        <p>다양한 게임 모드가 여기에 표시됩니다.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">문제로 사용할 퀴즈 세트 선택</h3>
                    <ScrollArea className="h-72 border rounded-md p-4">
                        {gameSets.length > 0 ? (
                            <div className="space-y-2">
                                {gameSets.map(set => (
                                    <div key={set.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-secondary">
                                        <Checkbox 
                                            id={`set-${set.id}`}
                                            checked={selectedSets[set.id] || false}
                                            onCheckedChange={(checked) => handleSetSelection(set.id, !!checked)}
                                        />
                                        <Label htmlFor={`set-${set.id}`} className="w-full cursor-pointer flex-grow">
                                            <p className="font-semibold">{set.title}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {set.questions.length} 문제 · 제작자: {set.creatorNickname} · {set.isPublic ? '공개' : '내 퀴즈'}
                                            </p>
                                        </Label>
                                        <Button variant="outline" size="sm" onClick={() => setPreviewGameSet(set)}>
                                            <Eye className="h-4 w-4 mr-1" />
                                            미리보기
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                <p>불러올 퀴즈 세트가 없습니다.</p>
                                <p className="text-xs">퀴즈를 만들거나 공개된 다른 퀴즈를 이용해주세요.</p>
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <Button 
                    size="lg" 
                    className="w-full font-headline" 
                    disabled={isCreating}
                    onClick={handleCreateSurvivalQuiz}
                >
                    {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Swords className="mr-2 h-5 w-5" />}
                    서바이벌 퀴즈방 만들기
                </Button>

            </CardContent>
        </Card>
    </div>
      <Dialog open={!!previewGameSet} onOpenChange={() => setPreviewGameSet(null)}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>{previewGameSet?.title}</DialogTitle>
                <DialogDescription>
                    총 {previewGameSet?.questions.length}개의 질문이 있습니다.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4 py-4">
                    {previewGameSet?.questions.map((q, index) => (
                        <div key={index} className="p-4 rounded-md border bg-muted/50">
                            <p className="font-semibold whitespace-pre-wrap">{index + 1}. {q.question}</p>
                            {q.type === 'multipleChoice' && q.options && (
                                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                    {q.options.map((opt, i) => <div key={i} className={cn(q.correctAnswer === opt && "font-bold text-primary")}>- {opt}</div>)}
                                </div>
                            )}
                            <p className="mt-2 text-sm">정답: <span className="font-semibold text-primary">{q.correctAnswer || q.answer}</span></p>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </DialogContent>
    </Dialog>
    </>
  );
}
