

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
import { Book, PlusCircle, Users, Star, Pencil, Trash2, HelpCircle, Lock, Globe, Search, RotateCcw, Loader2, BarChart3, AlertTriangle, ShieldOff, LogIn, ShieldCheck, List, Gamepad2, Sparkles, Smartphone, Tv, Gem, MessageSquare, Send, ThumbsUp, Swords } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useRef, useMemo } from 'react';
import { collection, onSnapshot, query, doc, deleteDoc, where, Unsubscribe, updateDoc, increment, arrayUnion, getDoc, serverTimestamp, Timestamp, getDocs, writeBatch, addDoc, orderBy, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { GameSet, User as FsUser, GameRoom, PlayedGameSet, GameSetComment, SurvivalGameRoom, TeamBattleGameRoom } from '@/lib/types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PixelAvatar } from '@/components/pixel-avatar';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';


const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];
const ITEMS_PER_PAGE = 9;
const DEACTIVATION_PASSWORD = "dodam12";

interface GameSetDocument extends GameSet {
  id: string;
}

interface OpenGameRoom extends GameRoom {
    gameSet?: GameSet;
}

interface CombinedOpenRoom {
  id: string;
  roomTitle: string;
  gameSetTitle: string;
  playerCount: number;
  maxPlayers: number;
  questionCount: number | string;
  password?: string;
  type: 'regular' | 'survival' | 'team-battle';
  raw: GameRoom | SurvivalGameRoom | TeamBattleGameRoom;
  createdAt: Timestamp;
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
  const [openSurvivalRooms, setOpenSurvivalRooms] = useState<SurvivalGameRoom[]>([]);
  const [openTeamBattleRooms, setOpenTeamBattleRooms] = useState<TeamBattleGameRoom[]>([]);
  const [playedGameSetIds, setPlayedGameSetIds] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState<string | null>(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  
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

  const [comments, setComments] = useState<GameSetComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [isClient, setIsClient] = useState(false);


  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchGrade, setSearchGrade] = useState('');
  const [searchSemester, setSearchSemester] = useState('');
  const [searchSubject, setSearchSubject] = useState('');

  const isAdmin = user ? ADMIN_EMAILS.includes(user.email || '') : false;

  const [currentUserData, setCurrentUserData] = useState<FsUser | null>(null);
  const [teacherData, setTeacherData] = useState<FsUser | null>(null);
  const [classmateIds, setClassmateIds] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userRef, (userDoc) => {
      if (userDoc.exists()) {
        const userData = userDoc.data() as FsUser;
        setCurrentUserData(userData);
        if (userData.classId && userData.role !== 'teacher') {
          const teacherRef = doc(db, 'users', userData.classId);
          const unsubTeacher = onSnapshot(teacherRef, (teacherDoc) => {
            if (teacherDoc.exists()) {
              setTeacherData(teacherDoc.data() as FsUser);
            }
          });
          const classmatesQuery = query(collection(db, 'users'), where('classId', '==', userData.classId));
          const unsubClassmates = onSnapshot(classmatesQuery, (snapshot) => {
            setClassmateIds(snapshot.docs.map(d => d.id));
          });
          return () => {
            unsubTeacher();
            unsubClassmates();
          }
        } else if (userData.role === 'teacher') {
          setTeacherData(userData);
           const classmatesQuery = query(collection(db, 'users'), where('classId', '==', user.uid));
           const unsubClassmates = onSnapshot(classmatesQuery, (snapshot) => {
            setClassmateIds(snapshot.docs.map(d => d.id));
          });
          return () => unsubClassmates();
        }
      }
    });
    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!user) return;
  
    const playedSetsQuery = collection(db, 'users', user.uid, 'playedGameSets');
    const unsubscribe = onSnapshot(playedSetsQuery, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data() as PlayedGameSet;
        if (data.gameSetId) {
          ids.add(data.gameSetId);
        }
      });
      setPlayedGameSetIds(ids);
    });
  
    return () => unsubscribe();
  }, [user]);

  const canEarnClassPoints = (gameSet: GameSetDocument): boolean => {
    if (!teacherData || !user || currentUserData?.role === 'teacher') return false;

    const rule = teacherData.pointAcquisitionRule || 'all';
    const teacherId = teacherData.uid;

    switch (rule) {
      case 'teacher_only':
        return gameSet.creatorId === teacherId;
      case 'class_only':
        return gameSet.creatorId === teacherId || classmateIds.includes(gameSet.creatorId);
      case 'all':
        return true;
      default:
        return false;
    }
  };

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
        const oldRoomsQuery = query(collection(db, 'game-rooms'), where('status', '==', 'waiting'));
        const oldSurvivalRoomsQuery = query(collection(db, 'survival-game-rooms'), where('status', '==', 'waiting'));
        const oldTeamBattleRoomsQuery = query(collection(db, 'team-battle-rooms'), where('status', '==', 'waiting'));

        try {
            const [regularSnapshot, survivalSnapshot, teamBattleSnapshot] = await Promise.all([
              getDocs(oldRoomsQuery), 
              getDocs(oldSurvivalRoomsQuery),
              getDocs(oldTeamBattleRoomsQuery)
            ]);
            const batch = writeBatch(db);

            regularSnapshot.forEach(doc => {
                const room = doc.data() as GameRoom;
                if (room.createdAt && room.createdAt.toDate() < tenMinutesAgo) {
                    batch.delete(doc.ref);
                }
            });
            survivalSnapshot.forEach(doc => {
                const room = doc.data() as SurvivalGameRoom;
                if (room.createdAt && room.createdAt.toDate() < tenMinutesAgo) {
                    batch.delete(doc.ref);
                }
            });
             teamBattleSnapshot.forEach(doc => {
                const room = doc.data() as TeamBattleGameRoom;
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

    const roomsQuery = query(collection(db, 'game-rooms'), where('status', '==', 'waiting'), where('joinType', '==', 'remote'));
    const roomsUnsubscribe = onSnapshot(roomsQuery, async (snapshot) => {
      const roomsPromises = snapshot.docs.map(async (roomDoc) => {
        const roomData = roomDoc.data() as GameRoom;
        const isHostPresent = roomData.players && roomData.hostId && roomData.players[roomData.hostId];
        if (!isHostPresent) return null;

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

    const survivalRoomsQuery = query(collection(db, 'survival-game-rooms'), where('status', '==', 'waiting'));
    const survivalRoomsUnsubscribe = onSnapshot(survivalRoomsQuery, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SurvivalGameRoom));
        const joinableRooms = rooms.filter(room => {
            if (room.hostId === user?.uid) return false;
            if (room.participationScope === 'public') return true;
            if (room.participationScope === 'class' && currentUserData?.classId === room.hostId) {
                return true;
            }
            return false;
        });
        setOpenSurvivalRooms(joinableRooms);
    }, (error) => {
        console.error("Error fetching survival game rooms:", error);
    });

    const teamBattleRoomsQuery = query(collection(db, 'team-battle-rooms'), where('status', '==', 'waiting'));
    const teamBattleRoomsUnsubscribe = onSnapshot(teamBattleRoomsQuery, (snapshot) => {
        const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamBattleGameRoom));
        const joinableRooms = rooms.filter(room => {
            if (room.hostId === user?.uid) return false;
            if (room.participationScope === 'public') return true;
            if (room.participationScope === 'class' && currentUserData?.classId === room.hostId) {
                return true;
            }
            return false;
        });
        setOpenTeamBattleRooms(joinableRooms);
    }, (error) => {
        console.error("Error fetching team battle rooms:", error);
    });


    return () => {
        roomsUnsubscribe();
        survivalRoomsUnsubscribe();
        teamBattleRoomsUnsubscribe();
    };
}, [user, currentUserData, toast]);


  useEffect(() => {
      const combinedSets: Record<string, GameSetDocument> = {};
      
      publicSets.forEach(set => {
          combinedSets[set.id] = set;
      });
      
      privateSets.forEach(set => {
          combinedSets[set.id] = set;
      });

      const finalSets = Object.values(combinedSets).sort(
        (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
      );

      setAllGameSets(finalSets);
      setFilteredGameSets(finalSets);
  }, [publicSets, privateSets]);

    useEffect(() => {
    if (!selectedGameSet) {
      setComments([]);
      return;
    }

    const commentsQuery = query(collection(db, 'game-sets', selectedGameSet.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetComment));
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [selectedGameSet]);


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

  const handleJoinGame = async (room: CombinedOpenRoom) => {
    setIsJoining(room.id);
    if (room.type === 'regular' && room.password) {
        setTargetRoom(room.raw as GameRoom);
        setTargetRoomId(room.id);
        setShowPasswordDialog(true);
        setIsJoining(null);
    } else if (room.type === 'survival') {
        router.push(`/survival-quiz/${room.id}/lobby`);
    } else if (room.type === 'team-battle') {
        router.push(`/team-battle/${room.id}/lobby`);
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
        toast({ title: 'AI 평가 중', description: '퀴즈 세트의 교육적 가치를 AI가 분석하고 있습니다. 잠시만 기다려주세요.'});
        
        const questionsForEval = set.questions.map(q => ({
          question: q.question,
          answer: q.answer,
          correctAnswer: q.correctAnswer,
        }));

        const result = await evaluateQuizSet({
          title: set.title,
          description: set.description,
          grade: set.grade || '',
          subject: set.subject || '',
          unit: set.unit || '',
          questions: questionsForEval,
        });

        const gameSetRef = doc(db, 'game-sets', set.id);
        await updateDoc(gameSetRef, { evaluationScore: result.score });

        const updatedSet = { ...set, evaluationScore: result.score };
        setSelectedGameSet(updatedSet);

        // Update local state to reflect the new score
        setAllGameSets(prev => prev.map(s => s.id === set.id ? updatedSet : s));
        setFilteredGameSets(prev => prev.map(s => s.id === set.id ? updatedSet : s));
        
        toast({ title: 'AI 평가 완료', description: `평가 점수는 ${result.score}점입니다.`});

      } catch (error) {
        console.error('Error evaluating quiz set:', error);
        toast({ variant: 'destructive', title: '오류', description: 'AI 평가 중 오류가 발생했습니다.'});
        setSelectedGameSet(set); // Show preview even if evaluation fails
      } finally {
        setIsEvaluating(null);
      }
    } else {
      setSelectedGameSet(set);
    }
  };

  const handleLike = async (gameSet: GameSet) => {
    if (!user) return;
    const gameSetRef = doc(db, 'game-sets', gameSet.id);
    const alreadyLiked = (gameSet.likedBy || []).includes(user.uid);
    const newLikeCount = (gameSet.likeCount || 0) + (alreadyLiked ? -1 : 1);
    const newLikedBy = alreadyLiked 
      ? (gameSet.likedBy || []).filter(uid => uid !== user.uid)
      : [...(gameSet.likedBy || []), user.uid];
  
    try {
      await updateDoc(gameSetRef, {
        likeCount: newLikeCount,
        likedBy: newLikedBy,
      });
  
      const updater = (set: GameSetDocument) => {
          if (set.id === gameSet.id) {
              return { ...set, likeCount: newLikeCount, likedBy: newLikedBy };
          }
          return set;
      };
      
      setAllGameSets(prev => prev.map(updater));
      setFilteredGameSets(prev => prev.map(updater));
      setSelectedGameSet(prev => (prev && prev.id === gameSet.id ? updater(prev) : prev));
  
    } catch (error) {
      console.error("Error liking game set:", error);
      toast({ variant: "destructive", title: "오류", description: "좋아요 처리 중 오류가 발생했습니다." });
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || !selectedGameSet || !currentUserData) return;

    setIsPostingComment(true);
    const gameSetRef = doc(db, 'game-sets', selectedGameSet.id);
    const newCommentRef = doc(collection(gameSetRef, 'comments'));
    
    try {
       await runTransaction(db, async (transaction) => {
            const commentData = {
                userId: user.uid,
                userNickname: currentUserData.displayName,
                userAvatar: currentUserData.pixelAvatar || null,
                comment: newComment,
                createdAt: serverTimestamp()
            };
            transaction.set(newCommentRef, commentData);
            transaction.update(gameSetRef, { commentCount: increment(1) });
       });

       setNewComment("");
       setSelectedGameSet(prev => prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null);

    } catch (error) {
      console.error("Error posting comment: ", error);
      toast({ variant: "destructive", title: "오류", description: "댓글 작성 중 오류가 발생했습니다."});
    } finally {
      setIsPostingComment(false);
    }
  };

  const allOpenRooms = useMemo((): CombinedOpenRoom[] => {
    const regularRooms: CombinedOpenRoom[] = openGameRooms.map(room => ({
        id: room.id,
        roomTitle: room.roomTitle,
        gameSetTitle: room.gameSet?.title || '퀴즈 정보 로딩 중...',
        playerCount: Object.keys(room.players).length,
        maxPlayers: 6,
        questionCount: room.gameSet?.questions?.length || '?',
        password: room.password,
        type: 'regular',
        raw: room,
        createdAt: room.createdAt,
    }));

    const survivalRooms: CombinedOpenRoom[] = openSurvivalRooms.map(room => ({
        id: room.id,
        roomTitle: room.roomTitle,
        gameSetTitle: '서바이벌 퀴즈',
        playerCount: Object.keys(room.players).length,
        maxPlayers: 100,
        questionCount: room.allQuestions.length,
        password: '', // No password for survival rooms yet
        type: 'survival',
        raw: room,
        createdAt: room.createdAt,
    }));

    const teamBattleRooms: CombinedOpenRoom[] = openTeamBattleRooms.map(room => ({
        id: room.id,
        roomTitle: room.roomTitle,
        gameSetTitle: '팀 대항전',
        playerCount: Object.keys(room.players).length,
        maxPlayers: 100, 
        questionCount: room.allQuestions.length,
        password: '',
        type: 'team-battle',
        raw: room,
        createdAt: room.createdAt,
    }));

    return [...regularRooms, ...survivalRooms, ...teamBattleRooms].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
}, [openGameRooms, openSurvivalRooms, openTeamBattleRooms]);


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

  const hasUserPlayedSelectedSet = selectedGameSet ? playedGameSetIds.has(selectedGameSet.id) : false;

  return (
    <>
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-bold font-headline">안녕하세요, {(user && !loadingUser) ? currentUserData?.displayName || user.displayName : '게스트'}님!</h1>
          <p className="text-muted-foreground mt-1">오늘도 즐거운 학습을 시작해볼까요?</p>
        </div>

        <div className={cn(
            "grid gap-6",
            currentUserData?.role === 'teacher' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
        )}>
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
            {currentUserData?.role === 'teacher' && (
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center gap-2"><Swords className="text-primary"/>서바이벌 퀴즈 만들기</CardTitle>
                        <CardDescription>여러 퀴즈를 묶어 최후의 1인을 가리는 퀴즈쇼를 만듭니다.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild className="w-full">
                            <Link href="/survival-quiz/create"><Swords className="mr-2 h-4 w-4"/>만들기</Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>

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
            ) : allOpenRooms.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">현재 참여 가능한 게임방이 없습니다. 새로운 게임방을 만들어보세요!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allOpenRooms.map(room => (
                        <Card key={room.id} className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="font-headline truncate flex items-center gap-2">
                                     {room.type === 'survival' && <Swords className="w-5 h-5 text-destructive"/>}
                                     {room.type === 'team-battle' && <Swords className="w-5 h-5 text-purple-500"/>}
                                     {room.roomTitle}
                                </CardTitle>
                                <CardDescription className="truncate">{room.gameSetTitle}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4"/>
                                    <span>{room.playerCount} / {room.maxPlayers}명</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Book className="w-4 h-4"/>
                                    <span>{room.questionCount} 문제</span>
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
              <div className="flex gap-2 col-start-1 sm:col-start-auto">
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
                const isPointEligible = canEarnClassPoints(set);
                const hasPlayed = playedGameSetIds.has(set.id);
                
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
                } else if (hasPlayed && !isAdmin) {
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
                          <p>이미 플레이한 퀴즈입니다.</p>
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
                                  {isPointEligible && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Gem className="w-4 h-4 text-blue-500" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>이 퀴즈로 학급 포인트를 얻을 수 있습니다.</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
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
                          <div className="flex flex-col items-end gap-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Book className="h-4 w-4" />
                                <span>{set.questions.length} 문제</span>
                              </div>
                              <div className="flex items-center gap-2 text-primary font-semibold">
                                <BarChart3 className="h-4 w-4" />
                                <span>활용 {set.playCount || 0}회</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <ThumbsUp className="h-4 w-4" />
                                  <span>{set.likeCount || 0}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>{set.commentCount || 0}</span>
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
                        {isEvaluating === set.id ? <Loader2 className="h-4 w-4 animate-spin" /> : '미리보기'}
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
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <div className="flex justify-between items-start">
                  <div>
                      <DialogTitle className="font-headline text-2xl">{selectedGameSet.title}</DialogTitle>
                      <DialogDescription>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                           <span>{[selectedGameSet.grade, selectedGameSet.semester, selectedGameSet.subject, selectedGameSet.unit].filter(Boolean).join(' / ')}</span>
                           <span className="flex items-center gap-1"><Book className="w-4 h-4" />{selectedGameSet.questions.length} 문제</span>
                           <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" />{selectedGameSet.likeCount || 0}</span>
                           <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" />{selectedGameSet.commentCount || 0}</span>
                        </div>
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
            <Tabs defaultValue="questions">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="questions"><Book className="w-4 h-4 mr-2" />문제 목록</TabsTrigger>
                <TabsTrigger value="comments" className="relative">
                  <MessageSquare className="w-4 h-4 mr-2" />댓글 ({selectedGameSet.commentCount || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="questions">
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
                                        <Image src={q.imageUrl} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" />
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
              </TabsContent>
              <TabsContent value="comments">
                <div className="flex flex-col h-96">
                  <ScrollArea className="flex-grow pr-6">
                    <div className="space-y-4">
                      {comments.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">아직 댓글이 없습니다.</div>
                      ) : (
                        comments.map(comment => {
                          let pixelAvatarData = null;
                          if (comment.userAvatar) {
                            try { pixelAvatarData = JSON.parse(comment.userAvatar); } catch (e) {}
                          }
                          return (
                            <div key={comment.id} className="flex gap-3">
                              <Avatar className="h-9 w-9">
                                <PixelAvatar pixels={pixelAvatarData} />
                              </Avatar>
                              <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-sm">{comment.userNickname}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {isClient && comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ko }) : null}
                                  </span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>
                  {hasUserPlayedSelectedSet && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleLike(selectedGameSet)}>
                            <ThumbsUp className={cn("mr-2 h-4 w-4", (selectedGameSet.likedBy || []).includes(user!.uid) && "fill-primary text-primary-foreground")} />
                            좋아요 {selectedGameSet.likeCount || 0}
                        </Button>
                        <Input 
                          placeholder="댓글을 입력하세요..." 
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          disabled={isPostingComment}
                          className="flex-grow"
                        />
                        <Button onClick={handlePostComment} disabled={isPostingComment || !newComment.trim()}>
                          {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
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





