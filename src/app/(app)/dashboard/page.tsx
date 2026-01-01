
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
import { Input } from '@/components/ui/input';
import { Book, PlusCircle, Users, Star, Pencil, Trash2, HelpCircle, Lock, Globe, Search, RotateCcw, Loader2, BarChart3, AlertTriangle, ShieldOff, LogIn, ShieldCheck, List, Gamepad2, Sparkles, Smartphone, Tv } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, where, Unsubscribe, updateDoc, increment, arrayUnion, getDoc, serverTimestamp, Timestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GameSet, User as FsUser, GameRoom } from '@/lib/types';
import { auth } from '@/lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { ADMIN_EMAILS } from '@/lib/admins';
import { cn } from '@/lib/utils';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { MotionDiv } from '@/components/motion-div';
import { evaluateQuizSet } from '@/ai/flows/validate-quiz-set-flow';


const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];
const ITEMS_PER_PAGE = 9;
const DEACTIVATION_PASSWORD = "dodam12";

interface GameSetDocument extends GameSet {
  id: string;
}

interface OpenGameRoom extends GameRoom {
    gameSet?: GameSet;
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


export default function DashboardPage() {
  const [user, loadingUser] = useAuthState(auth);
  const router = useRouter();
  
  const [publicSets, setPublicSets] = useState<GameSetDocument[]>([]);
  const [privateSets, setPrivateSets] = useState<GameSetDocument[]>([]);
  const [allGameSets, setAllGameSets] = useState<GameSetDocument[]>([]);
  const [filteredGameSets, setFilteredGameSets] = useState<GameSetDocument[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [openGameRooms, setOpenGameRooms] = useState<OpenGameRoom[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null);
  
  const [selectedGameSet, setSelectedGameSet] = useState<GameSetDocument | null>(null);
  const [gameCreationCandidate, setGameCreationCandidate] = useState<GameSetDocument | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GameSetDocument | null>(null);
  const [reportCandidate, setReportCandidate] = useState<GameSetDocument | null>(null);
  const [oppositionCandidate, setOppositionCandidate] = useState<GameSetDocument | null>(null);
  const [deactivateCandidate, setDeactivateCandidate] = useState<GameSetDocument | null>(null);
  
  const [deactivationPassword, setDeactivationPassword] = useState("");

  const { toast } = useToast();
  
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [targetRoom, setTargetRoom] = useState<GameRoom | null>(null);
  const [targetRoomId, setTargetRoomId] = useState<string | null>(null);


  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchSemester, setSearchSemester] = useState('');
  const [searchSubject, setSearchSubject] = useState('');

  const isAdmin = user ? ADMIN_EMAILS.includes(user.email || '') : false;
  
  useEffect(() => {
    setLoading(true);

    const publicQuery = query(collection(db, 'game-sets'), where('isPublic', '==', true));
    const publicUnsubscribe = onSnapshot(publicQuery, (snapshot) => {
        const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetDocument));
        setPublicSets(sets);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching public game sets: ", error);
        toast({ variant: "destructive", title: "오류", description: "공개 퀴즈 세트를 불러오는 중 오류가 발생했습니다." });
        setLoading(false);
    });

    let privateUnsubscribe: Unsubscribe | null = null;
    if (user) {
        const privateQuery = query(
            collection(db, 'game-sets'),
            where('creatorId', '==', user.uid),
            where('isPublic', '==', false)
        );
        privateUnsubscribe = onSnapshot(privateQuery, (snapshot) => {
            const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetDocument));
            setPrivateSets(sets);
        }, (error) => {
            console.error("Error fetching private game sets: ", error);
            toast({ variant: "destructive", title: "오류", description: "비공개 퀴즈 세트를 불러오는 중 오류가 발생했습니다." });
        });
    } else {
        setPrivateSets([]);
    }

    return () => {
        publicUnsubscribe();
        if (privateUnsubscribe) {
            privateUnsubscribe();
        }
    };
  }, [user, toast]);

  useEffect(() => {
    setLoadingRooms(true);

    const cleanupOldRooms = async () => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const oldRoomsQuery = query(
            collection(db, 'game-rooms'),
            where('status', '==', 'waiting')
        );

        try {
            const snapshot = await getDocs(oldRoomsQuery);
            const batch = writeBatch(db);
            snapshot.forEach(doc => {
                const room = doc.data() as GameRoom;
                if (room.createdAt && room.createdAt.toDate() < tenMinutesAgo) {
                    batch.delete(doc.ref);
                }
            });
            await batch.commit();
        } catch (error) {
            console.error("Error cleaning up old game rooms:", error);
        }
    };

    cleanupOldRooms();

    const roomsQuery = query(
      collection(db, 'game-rooms'),
      where('status', '==', 'waiting'),
      where('joinType', '==', 'remote')
    );

    const roomsUnsubscribe = onSnapshot(roomsQuery, async (snapshot) => {
      const roomsPromises = snapshot.docs.map(async (roomDoc) => {
        const roomData = roomDoc.data() as GameRoom;
        
        // 호스트가 현재 players 목록에 있는지 확인
        const isHostPresent = roomData.players && roomData.hostId && roomData.players[roomData.hostId];
        
        if (!isHostPresent) {
          return null; // 호스트가 없으면 목록에 포함하지 않음
        }

        const setDocRef = doc(db, 'game-sets', roomData.gameSetId);
        const setDocSnap = await getDoc(setDocRef);
        return {
          ...roomData,
          id: roomDoc.id,
          gameSet: setDocSnap.exists() ? (setDocSnap.data() as GameSet) : undefined,
        };
      });

      const rooms = (await Promise.all(roomsPromises)).filter(room => room !== null) as OpenGameRoom[];
      
      setOpenGameRooms(rooms);
      setLoadingRooms(false);
    }, (error) => {
      console.error("Error fetching open game rooms:", error);
      toast({ variant: "destructive", title: "오류", description: "참여 가능한 게임방 목록을 불러오는 중 오류가 발생했습니다." });
      setLoadingRooms(false);
    });

    return () => roomsUnsubscribe();
  }, [toast]);


  useEffect(() => {
      const combinedSets: Record<string, GameSetDocument> = {};
      
      publicSets.forEach(set => {
          combinedSets[set.id] = set;
      });
      
      privateSets.forEach(set => {
          combinedSets[set.id] = set;
      });

      const finalSets = Object.values(combinedSets).sort(
        (a, b) => (b.playCount || 0) - (a.playCount || 0) || (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );

      setAllGameSets(finalSets);
      setFilteredGameSets(finalSets);
  }, [publicSets, privateSets]);


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

  const handleReport = async () => {
    if (!reportCandidate || !user) return;
    
    // Check if user has already reported this set
    if (reportCandidate.reportedBy?.includes(user.uid)) {
        toast({ variant: "destructive", title: "중복 신고", description: "이미 신고한 퀴즈 세트입니다." });
        setReportCandidate(null);
        return;
    }
    
    // Check daily report limit
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return;

    const userData = userSnap.data() as FsUser;
    const today = new Date().toISOString().split('T')[0];
    const lastReportDay = userData.lastReportDate ? (userData.lastReportDate as Timestamp).toDate().toISOString().split('T')[0] : null;

    let newReportCount = userData.dailyReportCount || 0;
    
    if (today !== lastReportDay) {
      newReportCount = 0;
    }

    if (newReportCount >= 3) {
      toast({ variant: "destructive", title: "신고 한도 초과", description: "하루 신고 횟수를 초과했습니다. 내일 다시 시도해주세요." });
      setReportCandidate(null);
      return;
    }

    try {
        const gameSetRef = doc(db, 'game-sets', reportCandidate.id);
        const currentReportCount = (reportCandidate.reportCount || 0) + 1;
        const updateData: any = { 
            reportCount: increment(1),
            reportedBy: arrayUnion(user.uid)
        };

        if (currentReportCount >= 5) {
            updateData.isDisabled = true;
        }
        await updateDoc(gameSetRef, updateData);
        
        await updateDoc(userRef, {
            dailyReportCount: newReportCount + 1,
            lastReportDate: serverTimestamp(),
        });

        toast({ title: "신고 완료", description: "퀴즈 세트가 신고되었습니다. 검토 후 조치하겠습니다."});
        setReportCandidate(null);
    } catch(e) {
        toast({ variant: "destructive", title: "오류", description: "신고 처리 중 오류가 발생했습니다."});
    }
  };

  const handleOpposeReport = async () => {
    if (!oppositionCandidate) return;

    try {
        const gameSetRef = doc(db, 'game-sets', oppositionCandidate.id);
        const currentOppositionCount = (oppositionCandidate.oppositionCount || 0) + 1;

        if (currentOppositionCount >= 10) {
            await updateDoc(gameSetRef, {
                isDisabled: false,
                reportCount: 0,
                oppositionCount: 0,
                reportedBy: [],
            });
            toast({ title: '퀴즈 세트 복구됨', description: `"${oppositionCandidate.title}" 퀴즈 세트가 여러 사용자의 지지를 받아 다시 활성화되었습니다.` });
        } else {
            await updateDoc(gameSetRef, {
                oppositionCount: increment(1)
            });
            toast({ title: '신고 반대 완료', description: '신고에 반대 의견을 표시했습니다.' });
        }
        setOppositionCandidate(null);
    } catch (e) {
        toast({ variant: "destructive", title: "오류", description: "처리 중 오류가 발생했습니다." });
    }
  };


  const handleDeactivate = async () => {
    if (!deactivateCandidate) return;

    if (deactivationPassword !== DEACTIVATION_PASSWORD) {
        toast({ variant: 'destructive', title: '실패', description: '비밀번호가 올바르지 않습니다.'});
        return;
    }

    try {
        const gameSetRef = doc(db, 'game-sets', deactivateCandidate.id);
        await updateDoc(gameSetRef, { isDisabled: false, reportCount: 0, reportedBy: [] });
        toast({ title: '성공', description: `"${deactivateCandidate.title}" 퀴즈 세트가 다시 활성화되었습니다.`});
        setDeactivateCandidate(null);
        setDeactivationPassword("");
    } catch(e) {
        toast({ variant: 'destructive', title: '오류', description: '퀴즈 세트 활성화 중 오류가 발생했습니다.'});
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
    setCurrentPage(1);
  };
  
  const handleResetSearch = () => {
    setSearchKeyword('');
    setSearchGrade('');
    setSearchSemester('');
    setSearchSubject('');
    setFilteredGameSets(allGameSets);
    setCurrentPage(1);
  };

  const handleJoinGame = async (room: OpenGameRoom) => {
    setIsJoining(room.id);
    if (room.password) {
        setTargetRoom(room);
        setTargetRoomId(room.id);
        setShowPasswordDialog(true);
        setIsJoining(null);
    } else {
        router.push(`/game/${room.id}/lobby`);
    }
  };
  
  const handlePasswordConfirm = () => {
      if (password === targetRoom?.password) {
          setShowPasswordDialog(false);
          if (targetRoomId) {
            router.push(`/game/${targetRoomId}/lobby`);
          }
      } else {
          toast({ variant: 'destructive', title: '오류', description: '비밀번호가 올바르지 않습니다.' });
      }
  };

  const handlePreview = async (set: GameSetDocument) => {
    if (set.evaluationScore === undefined || set.evaluationScore === null) {
      setIsEvaluating(set.id);
      try {
        toast({ title: 'AI 평가 중', description: '퀴즈의 교육적 가치를 AI가 분석하고 있습니다. 잠시만 기다려주세요.' });
        const result = await evaluateQuizSet({
          title: set.title,
          description: set.description,
          grade: set.grade || '',
          subject: set.subject || '',
          unit: set.unit || '',
          questions: set.questions,
        });

        const gameSetRef = doc(db, 'game-sets', set.id);
        await updateDoc(gameSetRef, { evaluationScore: result.score });
        
        const updatedSet = { ...set, evaluationScore: result.score };
        
        // Update local state
        const updateState = (sets: GameSetDocument[]) => sets.map(s => s.id === updatedSet.id ? updatedSet : s);
        setPublicSets(updateState);
        setPrivateSets(updateState);

        setSelectedGameSet(updatedSet);
        toast({ title: 'AI 평가 완료!', description: `이 퀴즈 세트의 점수는 ${result.score}점입니다.` });
      } catch (error: any) {
        console.error("Error evaluating game set:", error);
        toast({ variant: 'destructive', title: 'AI 평가 실패', description: `평가 중 오류가 발생했습니다: ${error.message}` });
        setSelectedGameSet(set); // Show preview even if evaluation fails
      } finally {
        setIsEvaluating(null);
      }
    } else {
      setSelectedGameSet(set);
    }
  };


  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredGameSets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredGameSets.length / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">안녕하세요, {user?.displayName || '게스트'}님!</h1>
          <p className="text-muted-foreground mt-1">오늘도 즐거운 학습을 시작해볼까요?</p>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="font-headline">새로운 퀴즈 만들기</CardTitle>
                <CardDescription>나만의 퀴즈를 만들고 친구들과 함께 플레이하세요.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild className="w-full">
                    <Link href="/game-sets/create"><PlusCircle className="mr-2 h-4 w-4"/>만들기</Link>
                </Button>
            </CardContent>
        </Card>

        <div>
            <h2 className="text-2xl font-bold font-headline mb-4 flex items-center gap-2">
                <List />
                참여 가능한 게임방
            </h2>
            {loadingRooms ? (
                 <div className="text-center py-12">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="mt-2 text-muted-foreground">게임방 목록을 불러오는 중...</p>
                </div>
            ) : openGameRooms.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">현재 참여 가능한 게임방이 없습니다. 새로운 게임방을 만들어보세요!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {openGameRooms.map(room => (
                        <Card key={room.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-headline truncate">{room.roomTitle}</CardTitle>
                                <CardDescription className="truncate">{room.gameSet?.title || '퀴즈 정보 로딩 중...'}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4"/>
                                    <span>{Object.keys(room.players).length} / 6명</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Book className="w-4 h-4"/>
                                    <span>{room.gameSet?.questions?.length || '?'} 문제</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button className="w-full" onClick={() => handleJoinGame(room)} disabled={!!isJoining}>
                                    {isJoining === room.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : room.password ? <Lock className="w-4 h-4 mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
                                    참여하기
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
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
              <div className="flex gap-2 col-start-1 md:col-start-auto md:col-span-2 lg:col-span-1">
                <Button onClick={handleSearch} className="w-full"><Search className="mr-2 h-4 w-4" />검색</Button>
                <Button onClick={handleResetSearch} variant="outline" className="w-full"><RotateCcw className="mr-2 h-4 w-4" />초기화</Button>
              </div>
            </div>
          </Card>

          {loading || loadingUser ? (
            <div className="text-center py-12">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-muted-foreground">게임 세트를 불러오는 중...</p>
            </div>
          ) : currentItems.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground">{allGameSets.length > 0 ? '검색 결과가 없습니다.' : '아직 만들어진 게임 세트가 없습니다.'}</p>
                  {allGameSets.length === 0 && (
                    <Button asChild className="mt-4">
                        <Link href="/game-sets/create">첫 번째 퀴즈 만들어보기</Link>
                    </Button>
                  )}
              </div>
          ) : (
            <>
            <MotionDiv 
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={{
                visible: { transition: { staggerChildren: 0.1 } }
              }}
              initial="hidden"
              animate="visible"
            >
              {currentItems.map((set) => {
                const isCreator = user ? set.creatorId === user.uid : false;
                const isTopSet = !set.isDisabled && filteredGameSets.indexOf(set) < 5;
                const isDisabled = set.isDisabled === true;
                const { stars, color } = getStarRating(set.evaluationScore);
                
                let createRoomButton;
                if (isDisabled) {
                  createRoomButton = (
                    <Button size="sm" disabled={true}>
                      <Users className="mr-2 h-4 w-4" />비활성화됨
                    </Button>
                  );
                } else if (isCreator && !isAdmin) {
                  createRoomButton = (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button size="sm" disabled={true}>
                              <Users className="mr-2 h-4 w-4" />방 만들기
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>자신이 만든 퀴즈로는 게임을 시작할 수 없습니다.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                } else {
                  createRoomButton = (
                    <Button size="sm" onClick={() => setGameCreationCandidate(set)}>
                      <Users className="mr-2 h-4 w-4" />방 만들기
                    </Button>
                  );
                }

                return (
                <MotionDiv variants={cardVariants} key={set.id}>
                  <Card className={cn(
                      "hover:shadow-lg transition-shadow flex flex-col h-full", 
                      isTopSet && "border-primary/50 border-2 shadow-lg shadow-primary/20",
                      isDisabled && "bg-muted/50 opacity-60"
                  )}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                          <div>
                              <div className="flex items-center gap-2">
                                  <CardTitle className="font-headline">{set.title}</CardTitle>
                                  {set.isPublic ? (
                                      <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger><Globe className="w-4 h-4 text-muted-foreground"/></TooltipTrigger>
                                              <TooltipContent><p>공개</p></TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                  ) : (
                                      <TooltipProvider>
                                          <Tooltip>
                                              <TooltipTrigger><Lock className="w-4 h-4 text-muted-foreground"/></TooltipTrigger>
                                              <TooltipContent><p>비공개</p></TooltipContent>
                                          </Tooltip>
                                      </TooltipProvider>
                                  )}
                              </div>
                              <CardDescription className="mt-1">만든 사람: {set.creatorNickname}</CardDescription>
                              {isDisabled && (
                                <div className="mt-2 text-sm font-semibold text-destructive flex items-center gap-1">
                                      <ShieldOff className="w-4 h-4"/>
                                      <span>비활성화됨 (신고 {set.reportCount || 0}회)</span>
                                </div>
                              )}
                          </div>
                          <div className="flex flex-col items-end gap-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Book className="h-4 w-4" />
                                <span>{set.questions.length} 문제</span>
                              </div>
                              <div className="flex items-center gap-2 text-primary font-semibold">
                                <BarChart3 className="h-4 w-4" />
                                <span>활용 {set.playCount || 0}회</span>
                              </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={cn("flex items-center gap-1", color)}>
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
                      </div>
                    </CardHeader>
                    <CardFooter className="mt-auto flex flex-wrap justify-end items-center gap-2 p-4 pt-0 pr-4">
                      <Button variant="secondary" size="sm" onClick={() => handlePreview(set)} disabled={isEvaluating === set.id}>
                        {isEvaluating === set.id ? <Loader2 className="w-4 h-4 animate-spin"/> : '미리보기'}
                      </Button>
                      {(isCreator || isAdmin) && !isDisabled && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/game-sets/edit/${set.id}`}><Pencil className="h-4 w-4" /> 수정</Link>
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(set)}>
                            <Trash2 className="h-4 w-4" /> 삭제
                          </Button>
                        </>
                      )}
                      {isDisabled && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setOppositionCandidate(set)}>
                              <ShieldCheck className="h-4 w-4 mr-2" /> 신고 반대
                            </Button>
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => setDeactivateCandidate(set)}>
                                <ShieldOff className="mr-2 h-4 w-4"/>해제
                              </Button>
                            )}
                          </>
                      )}
                      {!isDisabled && createRoomButton}
                    </CardFooter>
                  </Card>
                </MotionDiv>
              )})}
            </MotionDiv>
            {totalPages > 1 && (
                <Pagination className="mt-8">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <PaginationItem key={page}>
                        <PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(page); }} isActive={currentPage === page}>
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      </div>

      {selectedGameSet && (
        <Dialog open={!!selectedGameSet} onOpenChange={(isOpen) => !isOpen && setSelectedGameSet(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <DialogTitle className="font-headline text-2xl">{selectedGameSet.title}</DialogTitle>
                      <DialogDescription>
                         {[selectedGameSet.grade, selectedGameSet.semester, selectedGameSet.subject, selectedGameSet.unit].filter(Boolean).join(' / ')}
                         {' · '}
                        총 {selectedGameSet.questions.length}개의 질문이 있습니다.
                      </DialogDescription>
                  </div>
                  {(selectedGameSet.evaluationScore !== undefined && selectedGameSet.evaluationScore !== null) && (() => {
                      const { stars, color } = getStarRating(selectedGameSet.evaluationScore);
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
                                          <span className="text-xs text-muted-foreground">AI 평가 점수: {selectedGameSet.evaluationScore}</span>
                                      </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                      <p>AI 평가 점수: {selectedGameSet.evaluationScore ?? '미평가'}</p>
                                  </TooltipContent>
                              </Tooltip>
                          </TooltipProvider>
                      );
                  })()}
              </div>
            </DialogHeader>
            <ScrollArea className="h-96 pr-6">
                <div className="space-y-4">
                    {selectedGameSet.questions.map((q, index) => (
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
                                    <Image src={encodeURI(q.imageUrl)} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" unoptimized={true} />
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
             <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => { setReportCandidate(selectedGameSet); setSelectedGameSet(null);}}>
                    <AlertTriangle className="mr-2 h-4 w-4"/> 신고하기
                </Button>
            </DialogFooter>
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

       <AlertDialog open={!!reportCandidate} onOpenChange={(isOpen) => !isOpen && setReportCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>퀴즈 세트를 신고하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{reportCandidate?.title}" 퀴즈에 부적절하거나 무의미한 내용이 있다고 판단되면 신고해주세요. 신고는 신중하게 해야 하며, 부당한 신고는 서비스 이용에 불이익을 초래할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleReport} className="bg-destructive hover:bg-destructive/90">신고</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!oppositionCandidate} onOpenChange={(isOpen) => !isOpen && setOppositionCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>신고에 반대하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 퀴즈 세트가 부당하게 비활성화되었다고 생각하시면 "신고 반대"를 눌러주세요. 많은 사용자가 반대하면 퀴즈는 다시 활성화될 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleOpposeReport}>신고 반대</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deactivateCandidate} onOpenChange={(isOpen) => !isOpen && setDeactivateCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>비활성화 해제</AlertDialogTitle>
            <AlertDialogDescription>
             비활성화된 퀴즈 세트를 다시 활성화하려면 관리자 비밀번호를 입력해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input 
                type="password"
                placeholder="비밀번호 입력"
                value={deactivationPassword}
                onChange={(e) => setDeactivationPassword(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeactivationPassword("")}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate}>해제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={showPasswordDialog} onOpenChange={(isOpen) => { if (!isOpen) { setShowPasswordDialog(false); setPassword(''); setTargetRoom(null); }}}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>비밀번호 입력</AlertDialogTitle>
                <AlertDialogDescription>
                    이 게임방은 비밀번호가 설정되어 있습니다. 참여하려면 비밀번호를 입력해주세요.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-2">
                <Input 
                    type="password"
                    placeholder="비밀번호 입력"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handlePasswordConfirm}>확인</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
