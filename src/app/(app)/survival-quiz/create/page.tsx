
'use client';

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot, addDoc, serverTimestamp, Timestamp, setDoc, getDoc } from 'firebase/firestore';
import type { GameSet, User, SurvivalGameRoom, Question, TeamBattleGameRoom, Team, TeamCooperationGameRoom, TeamCooperationPlayer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ShieldAlert, Swords, Eye, Search, RotateCcw, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

type SurvivalGameSet = GameSet & { isSelected?: boolean };

function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

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
  const [gameMode, setGameMode] = useState<'golden-bell' | 'team-battle' | 'team-cooperation'>('golden-bell');

  const [filteredGameSets, setFilteredGameSets] = useState<SurvivalGameSet[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchSemester, setSearchSemester] = useState('');
  const [searchSubject, setSearchSubject] = useState('');
  const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];

  // Golden Bell & Coop settings
  const [timeLimit, setTimeLimit] = useState(60);
  const [revivalEnabled, setRevivalEnabled] = useState(true);
  const [revivalPercentage, setRevivalPercentage] = useState(20);
  
  // Team Battle settings
  const [teamAssignment, setTeamAssignment] = useState<'manual' | 'random'>('manual');
  const [gameDuration, setGameDuration] = useState(5);

  // Team Cooperation settings
  const [targetScore, setTargetScore] = useState(1000);


  // Fetch user data to check for teacher role
  useEffect(() => {
    if (user) {
      const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
        if (doc.exists()) {
          const data = doc.data() as User;
          setUserData(data);
          if (data.role !== 'teacher') {
            toast({ variant: 'destructive', title: '권한 없음', description: '교사만 배틀 퀴즈를 만들 수 있습니다.' });
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
        setFilteredGameSets(sortedSets);
      } catch (error) {
        console.error("Error fetching game sets:", error);
        toast({ variant: 'destructive', title: '오류', description: '퀴즈 세트를 불러오는 중 오류가 발생했습니다.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchGameSets();
  }, [userData, user, toast]);

  const handleSearch = () => {
    let sets = [...gameSets];
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      sets = sets.filter(s => 
        s.title.toLowerCase().includes(keyword) || 
        (s.description && s.description.toLowerCase().includes(keyword))
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
    setFilteredGameSets(gameSets);
  };

  const handleSetSelection = (setId: string, isSelected: boolean) => {
    setSelectedSets(prev => ({ ...prev, [setId]: isSelected }));
  };
  
  const handleCreateQuiz = async () => {
    const selectedIds = Object.keys(selectedSets).filter(id => selectedSets[id]);
    
    if (!roomTitle.trim()) {
        toast({ variant: 'destructive', title: '오류', description: '방 제목을 입력해주세요.' });
        return;
    }
    if (selectedIds.length === 0) {
        toast({ variant: 'destructive', title: '오류', description: '하나 이상의 퀴즈 세트를 선택해주세요.' });
        return;
    }
    if (!user || !userData) {
        toast({ variant: 'destructive', title: '오류', description: '사용자 정보를 찾을 수 없습니다.' });
        return;
    }

    setIsCreating(true);

    try {
        const selectedGameSets = gameSets.filter(set => selectedIds.includes(set.id));
        let allQuestions: Question[] = [];
        selectedGameSets.forEach(set => {
            const sanitizedQuestions = set.questions.map(q => {
                const points = Number(q.points);
                return {
                    ...q,
                    points: isNaN(points) ? 10 : points,
                };
            });
            allQuestions = [...allQuestions, ...sanitizedQuestions];
        });
        allQuestions.sort(() => Math.random() - 0.5);
        allQuestions = allQuestions.map((q, i) => ({...q, id: i}));

        let collectionName = '';
        if (gameMode === 'golden-bell') {
            collectionName = 'survival-game-rooms';
        } else if (gameMode === 'team-cooperation') {
            collectionName = 'team-cooperation-rooms';
        } else { // team-battle
            collectionName = 'team-battle-rooms';
        }

        let newRoomId: string | undefined;
        let roomExists = true;
        while (roomExists) {
            newRoomId = generateRoomId();
            const roomRef = doc(db, collectionName, newRoomId);
            const roomSnap = await getDoc(roomRef);
            if (!roomSnap.exists()) {
                roomExists = false;
            }
        }

        if (!newRoomId) {
            throw new Error('고유한 방 ID 생성에 실패했습니다.');
        }

        const hostPlayer = {
            uid: user.uid,
            nickname: userData.displayName || '호스트',
            score: 0,
            isHost: true,
            pixelAvatar: userData.pixelAvatar,
        };
        
        if (gameMode === 'golden-bell') {
            const newRoomData: Omit<SurvivalGameRoom, 'id'> = {
                roomTitle,
                hostId: user.uid,
                status: 'waiting',
                createdAt: serverTimestamp() as Timestamp,
                gameSetIds: selectedIds,
                allQuestions,
                timeLimitPerQuestion: timeLimit,
                revivalEnabled,
                revivalPercentage,
                participationScope,
                players: { [user.uid]: { ...hostPlayer, isEliminated: false, answers: [] } },
                playerUIDs: [user.uid],
                currentQuestionIndex: -1,
                isAnswerRevealed: false,
                eliminatedPlayerIds: [],
                revivalHappened: false,
            };
            await setDoc(doc(db, 'survival-game-rooms', newRoomId), newRoomData);
            toast({ title: '성공', description: '배틀 퀴즈방을 만들었습니다! 로비로 이동합니다.' });
            router.push(`/survival-quiz/${newRoomId}/lobby`);
        } else if (gameMode === 'team-cooperation') {
            const newRoomData: Omit<TeamCooperationGameRoom, 'id'> = {
                roomTitle,
                hostId: user.uid,
                status: 'waiting',
                createdAt: serverTimestamp() as Timestamp,
                gameSetIds: selectedIds,
                allQuestions,
                targetScore,
                timeLimitPerQuestion: timeLimit,
                players: { [user.uid]: { ...hostPlayer, answers: [] } },
                teamScore: 0,
                currentQuestionIndex: 0,
            };
            await setDoc(doc(db, 'team-cooperation-rooms', newRoomId), newRoomData);
            toast({ title: '성공', description: '팀 협력전 퀴즈방을 만들었습니다! 로비로 이동합니다.' });
            router.push(`/team-cooperation/${newRoomId}/lobby`);
        } else { // team-battle
            const newRoomData: Omit<TeamBattleGameRoom, 'id'> = {
                roomTitle,
                hostId: user.uid,
                status: 'waiting',
                createdAt: serverTimestamp() as Timestamp,
                gameSetIds: selectedIds,
                allQuestions,
                teamAssignment,
                gameDuration,
                participationScope,
                players: { [user.uid]: { ...hostPlayer, isEliminated: false, answers: [] } },
                teams: {
                    teamA: { id: 'teamA', name: '레드 팀', score: 200 },
                    teamB: { id: 'teamB', name: '블루 팀', score: 200 },
                },
            };
            await setDoc(doc(db, 'team-battle-rooms', newRoomId), newRoomData);
            toast({ title: '성공', description: '팀 대항전 퀴즈방을 만들었습니다! 로비로 이동합니다.' });
            router.push(`/team-battle/${newRoomId}/lobby`);
        }

    } catch (error) {
        console.error("Error creating quiz room:", error);
        toast({ variant: 'destructive', title: '오류', description: '방 생성에 실패했습니다.' });
    } finally {
        setIsCreating(false);
    }
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
                    배틀 퀴즈방 만들기
                </CardTitle>
                <CardDescription>
                    여러 퀴즈 세트를 조합하여 대규모 배틀 퀴즈를 만듭니다.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-2">
                    <Label htmlFor="room-title" className="text-lg font-semibold">방 제목</Label>
                    <Input 
                        id="room-title"
                        placeholder="예: 제 1회 에듀칩 배틀 퀴즈쇼"
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
                    <h3 className="text-lg font-semibold">게임 모드 선택</h3>
                    <RadioGroup value={gameMode} onValueChange={(v: any) => setGameMode(v)} className="space-y-4">
                      <Card className={cn(gameMode === 'golden-bell' && 'border-primary ring-2 ring-primary')}>
                          <CardHeader>
                              <div className="flex items-center gap-3">
                                  <RadioGroupItem value="golden-bell" id="mode-golden-bell" />
                                  <Label htmlFor="mode-golden-bell" className="flex-1 cursor-pointer">
                                      <CardTitle>골든벨 모드</CardTitle>
                                      <CardDescription>마지막 한 명이 남을 때까지 진행되는 개인 서바이벌 퀴즈입니다.</CardDescription>
                                  </Label>
                              </div>
                          </CardHeader>
                          {gameMode === 'golden-bell' && (
                            <CardContent className="space-y-6 pt-4 pl-12">
                                <div className="space-y-2">
                                    <Label>문제당 시간 제한</Label>
                                    <RadioGroup value={String(timeLimit)} onValueChange={(val) => setTimeLimit(Number(val))} className="flex gap-4">
                                        <Label htmlFor="time-60" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="60" id="time-60" /> 1분
                                        </Label>
                                        <Label htmlFor="time-120" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="120" id="time-120" /> 2분
                                        </Label>
                                        <Label htmlFor="time-180" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="180" id="time-180" /> 3분
                                        </Label>
                                    </RadioGroup>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="revival-enabled" className="flex flex-col gap-1">
                                            <span>패자부활전 활성화</span>
                                            <span className="text-xs text-muted-foreground">게임이 70% 진행되었을 때 탈락자 중 일부가 부활합니다.</span>
                                        </Label>
                                        <Switch id="revival-enabled" checked={revivalEnabled} onCheckedChange={setRevivalEnabled} />
                                    </div>
                                    {revivalEnabled && (
                                        <div className="space-y-2 pl-2">
                                            <Label>부활 조건: 탈락자 중 상위 {revivalPercentage}%</Label>
                                            <Slider 
                                                value={[revivalPercentage]}
                                                onValueChange={(val) => setRevivalPercentage(val[0])}
                                                max={50}
                                                step={5}
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                          )}
                      </Card>
                       <Card className={cn(gameMode === 'team-cooperation' && 'border-primary ring-2 ring-primary')}>
                          <CardHeader>
                              <div className="flex items-center gap-3">
                                  <RadioGroupItem value="team-cooperation" id="mode-team-cooperation" />
                                  <Label htmlFor="mode-team-cooperation" className="flex-1 cursor-pointer">
                                      <CardTitle className="flex items-center gap-2"><Users />팀 협력전</CardTitle>
                                      <CardDescription>모든 참가자가 한 팀이 되어 공동의 목표 점수 달성을 위해 퀴즈를 풉니다.</CardDescription>
                                  </Label>
                              </div>
                          </CardHeader>
                          {gameMode === 'team-cooperation' && (
                            <CardContent className="space-y-6 pt-4 pl-12">
                                <div className="space-y-2">
                                    <Label>목표 점수: {targetScore.toLocaleString()}점</Label>
                                    <Slider 
                                        value={[targetScore]}
                                        onValueChange={(val) => setTargetScore(val[0])}
                                        min={500}
                                        max={5000}
                                        step={100}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>문제당 시간 제한</Label>
                                    <RadioGroup value={String(timeLimit)} onValueChange={(val) => setTimeLimit(Number(val))} className="flex gap-4">
                                        <Label htmlFor="coop-time-60" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="60" id="coop-time-60" /> 1분
                                        </Label>
                                        <Label htmlFor="coop-time-120" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="120" id="coop-time-120" /> 2분
                                        </Label>
                                        <Label htmlFor="coop-time-180" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="180" id="coop-time-180" /> 3분
                                        </Label>
                                    </RadioGroup>
                                </div>
                            </CardContent>
                          )}
                      </Card>
                      <Card className={cn(gameMode === 'team-battle' && 'border-primary ring-2 ring-primary')}>
                          <CardHeader>
                              <div className="flex items-center gap-3">
                                  <RadioGroupItem value="team-battle" id="mode-team-battle" />
                                  <Label htmlFor="mode-team-battle" className="flex-1 cursor-pointer">
                                      <CardTitle>팀 대항전</CardTitle>
                                      <CardDescription>두 팀으로 나뉘어 점수 대결을 펼칩니다.</CardDescription>
                                  </Label>
                              </div>
                          </CardHeader>
                          {gameMode === 'team-battle' && (
                            <CardContent className="space-y-6 pt-4 pl-12">
                               <div className="space-y-2">
                                    <Label>팀 배정 방식</Label>
                                    <RadioGroup value={teamAssignment} onValueChange={(val: any) => setTeamAssignment(val)} className="flex gap-4">
                                        <Label htmlFor="assign-manual" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="manual" id="assign-manual" /> 수동 배정
                                        </Label>
                                        <Label htmlFor="assign-random" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="random" id="assign-random" /> 랜덤 배정
                                        </Label>
                                    </RadioGroup>
                                </div>
                                <div className="space-y-2">
                                    <Label>게임 시간</Label>
                                    <RadioGroup value={String(gameDuration)} onValueChange={(val) => setGameDuration(Number(val))} className="flex gap-4">
                                        <Label htmlFor="duration-3" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="3" id="duration-3" /> 3분
                                        </Label>
                                        <Label htmlFor="duration-5" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="5" id="duration-5" /> 5분
                                        </Label>
                                        <Label htmlFor="duration-10" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer flex-1 has-[:checked]:border-primary has-[:checked]:bg-primary/10">
                                            <RadioGroupItem value="10" id="duration-10" /> 10분
                                        </Label>
                                    </RadioGroup>
                                </div>
                            </CardContent>
                          )}
                      </Card>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">문제로 사용할 퀴즈 세트 선택</h3>
                    <Card className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                            <div className="sm:col-span-2 lg:col-span-2 space-y-1">
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
                            <div className="col-start-1 sm:col-start-auto">
                                <Button onClick={handleSearch} className="w-full"><Search className="mr-2 h-4 w-4" />검색</Button>
                            </div>
                        </div>
                    </Card>
                    <ScrollArea className="h-72 border rounded-md p-4 mt-4">
                        {filteredGameSets.length > 0 ? (
                            <div className="space-y-2">
                                {filteredGameSets.map(set => (
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
                                <p>
                                    {gameSets.length > 0 ? '검색 결과가 없습니다.' : '불러올 퀴즈 세트가 없습니다.'}
                                </p>
                                {gameSets.length === 0 && <p className="text-xs">퀴즈를 만들거나 공개된 다른 퀴즈를 이용해주세요.</p>}
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <Button 
                    size="lg" 
                    className="w-full font-headline" 
                    disabled={isCreating}
                    onClick={handleCreateQuiz}
                >
                    {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Swords className="mr-2 h-5 w-5" />}
                    배틀 퀴즈방 만들기
                </Button>

            </CardContent>
        </Card>
    </div>
      <Dialog open={!!previewGameSet} onOpenChange={() => setPreviewGameSet(null)}>
        <DialogContent className="sm:max-w-2xl">
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

    