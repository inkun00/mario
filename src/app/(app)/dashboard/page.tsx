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
import { Book, PlusCircle, Users, Star, Pencil, Trash2, HelpCircle, Lock, Globe, Search, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, where, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GameSet } from '@/lib/types';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];

interface GameSetDocument extends GameSet {
  id: string;
}

export default function DashboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [allGameSets, setAllGameSets] = useState<GameSetDocument[]>([]);
  const [filteredGameSets, setFilteredGameSets] = useState<GameSetDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGameSet, setSelectedGameSet] = useState<GameSetDocument | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GameSetDocument | null>(null);
  const { toast } = useToast();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchSemester, setSearchSemester] = useState('');
  const [searchSubject, setSearchSubject] = useState('');

  useEffect(() => {
    if (loadingUser) {
      return;
    }
    setLoading(true);

    const handleSnapshots = (
      publicSnapshot: QuerySnapshot<DocumentData>, 
      privateSnapshot?: QuerySnapshot<DocumentData>
    ) => {
      const publicSets = publicSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetDocument));
      
      let finalSets = [...publicSets];
      const publicSetIds = new Set(publicSets.map(s => s.id));

      if (privateSnapshot) {
          const privateSets = privateSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetDocument));
          privateSets.forEach(privateSet => {
              if (!publicSetIds.has(privateSet.id)) {
                  finalSets.push(privateSet);
              }
          });
      }
      
      finalSets.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      
      setAllGameSets(finalSets);
      setFilteredGameSets(finalSets);
      setLoading(false);
    }

    const publicQuery = query(
      collection(db, 'game-sets'),
      where('isPublic', '==', true)
    );

    const publicUnsubscribe = onSnapshot(publicQuery, (publicSnapshot) => {
      if (user) {
        // Defer handling to combined handler
      } else {
        handleSnapshots(publicSnapshot);
      }
    }, (error) => {
      console.error("Error fetching public game sets: ", error);
      toast({ variant: "destructive", title: "오류", description: "퀴즈 세트를 불러오는 중 오류가 발생했습니다." });
      setLoading(false);
    });

    let privateUnsubscribe = () => {};
    if (user) {
      const privateQuery = query(
          collection(db, 'game-sets'),
          where('creatorId', '==', user.uid),
          where('isPublic', '==', false)
      );
      
      privateUnsubscribe = onSnapshot(privateQuery, async (privateSnapshot) => {
         const publicSnapshot = await getDocs(publicQuery);
         handleSnapshots(publicSnapshot, privateSnapshot);
      }, (error) => {
           console.error("Error fetching private game sets: ", error);
           toast({ variant: "destructive", title: "오류", description: "비공개 퀴즈 세트를 불러오는 중 오류가 발생했습니다." });
      });
    }


    return () => {
      publicUnsubscribe();
      privateUnsubscribe();
    };
  }, [user, loadingUser, toast]);

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
        await deleteDoc(doc(db, "game-sets", deleteCandidate.id));
        toast({ title: "성공", description: "퀴즈 세트를 삭제했습니다." });
        setDeleteCandidate(null);
    } catch (error) {
        console.error("Error deleting document: ", error);
        toast({ variant: "destructive", title: "오류", description: "퀴즈 세트 삭제 중 오류가 발생했습니다." });
    }
  };

  const handleSearch = () => {
    let sets = [...allGameSets];
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      sets = sets.filter(s => 
        s.title.toLowerCase().includes(keyword) || 
        s.description.toLowerCase().includes(keyword)
      );
    }
    if (searchGrade) {
      sets = sets.filter(s => s.grade === searchGrade);
    }
    if (searchSemester) {
      sets = sets.filter(s => s.semester === searchSemester);
    }
    if (searchSubject) {
      sets = sets.filter(s => s.subject === searchSubject);
    }
    setFilteredGameSets(sets);
  };
  
  const handleResetSearch = () => {
    setSearchKeyword('');
    setSearchGrade('');
    setSearchSemester('');
    setSearchSubject('');
    setFilteredGameSets(allGameSets);
  };

  return (
    <>
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
          
          <Card className="mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-5 lg:col-span-2 space-y-1">
                <Label htmlFor="search-keyword">제목/설명</Label>
                <Input 
                  id="search-keyword" 
                  placeholder="키워드 입력..." 
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="search-grade">학년</Label>
                <Select value={searchGrade} onValueChange={(value) => setSearchGrade(value === 'all' ? '' : value)}>
                  <SelectTrigger id="search-grade" className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {Array.from({ length: 6 }, (_, i) => i + 1).map(grade => (
                      <SelectItem key={grade} value={`${grade}학년`}>{grade}학년</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="search-semester">학기</Label>
                <Select value={searchSemester} onValueChange={(value) => setSearchSemester(value === 'all' ? '' : value)}>
                  <SelectTrigger id="search-semester" className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="1학기">1학기</SelectItem>
                    <SelectItem value="2학기">2학기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="search-subject">과목</Label>
                <Select value={searchSubject} onValueChange={(value) => setSearchSubject(value === 'all' ? '' : value)}>
                  <SelectTrigger id="search-subject" className="w-full">
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {subjects.map(subject => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 col-start-1 md:col-span-2 lg:col-span-1">
                <Button onClick={handleSearch} className="w-full"><Search className="mr-2 h-4 w-4" />검색</Button>
                <Button onClick={handleResetSearch} variant="outline" className="w-full"><RotateCcw className="mr-2 h-4 w-4" />초기화</Button>
              </div>
            </div>
          </Card>

          {loading ? (
            <p>게임 세트를 불러오는 중...</p>
          ) : filteredGameSets.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">{allGameSets.length > 0 ? '검색 결과가 없습니다.' : '아직 만들어진 게임 세트가 없습니다.'}</p>
                  {allGameSets.length === 0 && (
                    <Button asChild className="mt-4">
                        <Link href="/game-sets/create">첫 번째 퀴즈 만들어보기</Link>
                    </Button>
                  )}
              </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredGameSets.map((set) => {
                const isCreator = user && set.creatorId === user.uid;
                
                const createRoomButton = (
                    <Button asChild={!isCreator} size="sm" disabled={isCreator}>
                        {!isCreator ? (
                            <Link href={`/game-rooms/new?gameSetId=${set.id}`}><Users className="mr-2 h-4 w-4" />방 만들기</Link>
                        ) : (
                            <span><Users className="mr-2 h-4 w-4" />방 만들기</span>
                        )}
                    </Button>
                );

                return (
                <Card key={set.id} className="hover:shadow-lg transition-shadow flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="font-headline text-lg">{set.title}</CardTitle>
                                {set.isPublic ? (
                                    <Globe className="w-4 h-4 text-muted-foreground"/>
                                ) : (
                                    <Lock className="w-4 h-4 text-muted-foreground"/>
                                )}
                            </div>
                            <CardDescription className="mt-1">By {set.creatorNickname}</CardDescription>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Book className="h-4 w-4" />
                            <span>{set.questions.length} 문제</span>
                        </div>
                    </div>
                  </CardHeader>
                  <CardFooter className="mt-auto flex justify-end items-center gap-2">
                    <Button variant="ghost" onClick={() => setSelectedGameSet(set)}>미리보기</Button>
                    {isCreator && (
                      <>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/game-sets/edit/${set.id}`}><Pencil className="mr-2 h-4 w-4" /> 수정</Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(set)}>
                          <Trash2 className="mr-2 h-4 w-4" /> 삭제
                        </Button>
                      </>
                    )}
                    
                    <TooltipProvider>
                      {isCreator ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0}>{createRoomButton}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>자신이 만든 퀴즈로는 게임을 시작할 수 없습니다.</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        createRoomButton
                      )}
                    </TooltipProvider>

                  </CardFooter>
                </Card>
              )})}
            </div>
          )}
        </div>
      </div>

      {selectedGameSet && (
        <Dialog open={!!selectedGameSet} onOpenChange={(isOpen) => !isOpen && setSelectedGameSet(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="font-headline text-2xl">{selectedGameSet.title}</DialogTitle>
              <DialogDescription>
                 {[selectedGameSet.grade, selectedGameSet.semester, selectedGameSet.subject, selectedGameSet.unit].filter(Boolean).join(' / ')}
                 {' · '}
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
                                    <Image src={encodeURI(q.imageUrl)} alt={`Question ${index + 1} image`} fill className="rounded-md object-contain" unoptimized={true} />
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
    </>
  );
}

    