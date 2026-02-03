
'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { User, IncorrectAnswer, Question, SubjectStat, SolvedIncorrectAnswer, GameSet, GameSetComment, PlayedGameSet, PointLog, WritingSubmission, EvaluateWritingOutput } from '@/lib/types';
import { doc, getDoc, collection, getDocs, updateDoc, increment, deleteDoc, query, orderBy, setDoc, serverTimestamp, where, Timestamp, onSnapshot, limit, runTransaction, addDoc, QueryDocumentSnapshot, DocumentSnapshot, QuerySnapshot, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Loader2, FileWarning, School, BookOpen, BarChart2, CheckCircle, XCircle, Pencil, Save, X, Users, KeyRound, Edit, Gem, Package, Send,MinusCircle, LogOut, Undo2, Settings, Trash2, Eye, MessageSquare, LineChart, PieChart as PieChartIcon, History, ThumbsUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { getLevelInfo, getNextLevelInfo, LevelInfo, levelSystem } from '@/lib/level-system';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Combobox } from '@/components/ui/combobox';
import dynamic from 'next/dynamic';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, ResponsiveContainer, Cell, Pie, PieChart, Legend } from 'recharts';
import { generateWritingTopic } from '@/ai/flows/generate-writing-topic-flow';
import { evaluateWriting } from '@/ai/flows/evaluate-writing-flow';


const PixelEditor = dynamic(() => import('@/components/pixel-editor').then(mod => mod.PixelEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});


interface ReviewQuestion extends IncorrectAnswer {
    userReviewAnswer?: string;
    isSubmitting?: boolean;
}

const calculateSimilarity = (a: string, b: string): number => {
  const s1 = a.replace(/\s+/g, '');
  const s2 = b.replace(/\s+/g, '');

  if (s1.length === 0) return s2.length === 0 ? 100 : 0;
  if (s2.length === 0) return s1.length === 0 ? 100 : 0;

  const matrix = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) return 100;

  return (1 - distance / maxLength) * 100;
};


const transformStats = (flatStats: SubjectStat[]): SubjectStat[] => {
  return flatStats.map(stat => {
    let unitsObject: { [unitName: string]: { totalCorrect: number; totalIncorrect: number; } } = {};
    if (stat.units && typeof stat.units === 'object' && !Array.isArray(stat.units)) {
      unitsObject = stat.units;
      for (const unit of Object.keys(unitsObject)) {
        unitsObject[unit] = {
          totalCorrect: unitsObject[unit].totalCorrect || 0,
          totalIncorrect: unitsObject[unit].totalIncorrect || 0,
        };
      }
    } else {
      for (const key in stat) {
        if (key.startsWith('units.')) {
          const parts = key.split('.');
          const unitName = parts.slice(1, -1).join('.');
          const metric = parts[parts.length - 1];
          if (unitName && (metric === 'totalCorrect' || metric === 'totalIncorrect')) {
            if (!unitsObject[unitName]) {
              unitsObject[unitName] = { totalCorrect: 0, totalIncorrect: 0 };
            }
            (unitsObject[unitName] as any)[metric] = (stat[key as keyof SubjectStat] as number) || 0;
          }
        }
      }
    }

    const unitNames = Object.keys(unitsObject);
    const groups: string[][] = [];

    for (const unitName of unitNames) {
      let foundGroup = false;
      for (const group of groups) {
        if (calculateSimilarity(unitName.replace(/\s+/g, ''), group[0].replace(/\s+/g, '')) > 70) {
          group.push(unitName);
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) {
        groups.push([unitName]);
      }
    }

    const mergedUnits: { [unitName: string]: { totalCorrect: number; totalIncorrect: number; } } = {};
    let totalCorrectAggregated = 0;
    let totalIncorrectAggregated = 0;

    for (const group of groups) {
      const canonicalName = group.reduce((a, b) => (a.length <= b.length ? a : b));
      
      const aggregatedStats = { totalCorrect: 0, totalIncorrect: 0 };

      for (const unitName of group) {
        aggregatedStats.totalCorrect += unitsObject[unitName]?.totalCorrect || 0;
        aggregatedStats.totalIncorrect += unitsObject[unitName]?.totalIncorrect || 0;
      }
      
      mergedUnits[canonicalName] = aggregatedStats;
      totalCorrectAggregated += aggregatedStats.totalCorrect;
      totalIncorrectAggregated += aggregatedStats.totalIncorrect;
    }

    return {
      id: stat.id,
      totalCorrect: totalCorrectAggregated,
      totalIncorrect: totalIncorrectAggregated,
      units: mergedUnits,
    };
  });
};


export default function ProfilePage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ReviewQuestion[]>([]);
  const [solvedReviewQuestions, setSolvedReviewQuestions] = useState<SolvedIncorrectAnswer[]>([]);
  const [subjectStats, setSubjectStats] = useState<SubjectStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [nextLevelInfo, setNextLevelInfo] = useState<LevelInfo | null>(null);

  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  const [showIncorrectAnswersDialog, setShowIncorrectAnswersDialog] = useState(false);
  const [incorrectAnswersToShow, setIncorrectAnswersToShow] = useState<SolvedIncorrectAnswer[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editSchoolName, setEditSchoolName] = useState('');

  const [isTeacherDialog, setIsTeacherDialog] = useState(false);
  const [teacherCode, setTeacherCode] = useState('');

  const [isClassCodeDialog, setIsClassCodeDialog] = useState(false);
  const [classCode, setClassCode] = useState('');
  
  const [isJoinClassDialog, setIsJoinClassDialog] = useState(false);
  const [joinClassCode, setJoinClassCode] = useState('');
  const [isLeaveClassDialogOpen, setIsLeaveClassDialogOpen] = useState(false);

  const [isSendPointsDialogOpen, setIsSendPointsDialogOpen] = useState(false);
  const [sendPointsAmount, setSendPointsAmount] = useState(0);
  const [sendPointsRecipient, setSendPointsRecipient] = useState('');
  const [isSendingPoints, setIsSendingPoints] = useState(false);

  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [currentPixelAvatar, setCurrentPixelAvatar] = useState<string[][] | null>(null);
  
  const [classmates, setClassmates] = useState<{value: string, label: string}[]>([]);

  const [isPointManagementDialogOpen, setIsPointManagementDialogOpen] = useState(false);
  const [pointRule, setPointRule] = useState<'teacher_only' | 'class_only' | 'all'>('all');

  const [myGameSets, setMyGameSets] = useState<GameSet[]>([]);
  const [isLoadingMyGameSets, setIsLoadingMyGameSets] = useState(false);
  const [playedGameSets, setPlayedGameSets] = useState<GameSet[]>([]);
  const [isLoadingPlayedGameSets, setIsLoadingPlayedGameSets] = useState(true);
  const [previewGameSet, setPreviewGameSet] = useState<GameSet | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<GameSet | null>(null);
  
  const [comments, setComments] = useState<GameSetComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [playedGameSetIds, setPlayedGameSetIds] = useState<Set<string>>(new Set());

  const [isPointHistoryOpen, setIsPointHistoryOpen] = useState(false);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [isPointHistoryLoading, setIsPointHistoryLoading] = useState(false);
  const [chartView, setChartView] = useState<'income' | 'expense'>('income');
  const [isClient, setIsClient] = useState(false);

  const [writingTopic, setWritingTopic] = useState<{
    isOpen: boolean;
    isLoading: boolean;
    isEvaluating: boolean;
    topic: string | null;
    prompt: string | null;
    response: string;
    evaluation: EvaluateWritingOutput | null;
  }>({
    isOpen: false,
    isLoading: false,
    isEvaluating: false,
    topic: null,
    prompt: null,
    response: "",
    evaluation: null,
  });
  const [writingSubmissions, setWritingSubmissions] = useState<WritingSubmission[]>([]);
  const [viewingWritingSubmission, setViewingWritingSubmission] = useState<WritingSubmission | null>(null);


  useEffect(() => {
    setIsClient(true);
  }, []);


  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setIsLoadingMyGameSets(true);

    const userRef = doc(db, 'users', user.uid);
    const incorrectAnswersRef = collection(db, 'users', user.uid, 'incorrect-answers');
    const solvedIncorrectAnswersRef = collection(db, 'users', user.uid, 'solved-incorrect-answers');
    const subjectStatsRef = collection(db, 'users', user.uid, 'subjectStats');
    const myGameSetsQuery = query(collection(db, 'game-sets'), where('creatorId', '==', user.uid));
    const playedSetsQuery = query(collection(db, 'users', user.uid, 'playedGameSets'));
    const writingSubmissionsRef = collection(db, 'users', user.uid, 'writingSubmissions');
    
    try {
      const [
        userSnap, 
        incorrectSnapshot, 
        solvedIncorrectSnapshot, 
        subjectStatsSnapshot, 
        myGameSetsSnapshot, 
        playedSetsSnapshot,
        writingSubmissionsSnapshot
      ] = await Promise.all([
        getDoc(userRef),
        getDocs(query(incorrectAnswersRef, where('timestamp', '<=', new Date(Date.now() - 24 * 60 * 60 * 1000)), orderBy('timestamp', 'asc'))),
        getDocs(query(solvedIncorrectAnswersRef, orderBy('timestamp', 'desc'))),
        getDocs(subjectStatsRef),
        getDocs(myGameSetsQuery),
        getDocs(playedSetsQuery),
        getDocs(query(writingSubmissionsRef, orderBy('createdAt', 'desc')))
      ]) as [DocumentSnapshot, QuerySnapshot, QuerySnapshot, QuerySnapshot, QuerySnapshot, QuerySnapshot, QuerySnapshot];

      if (userSnap.exists()) {
        const fetchedUserData = userSnap.data() as User;
        setUserData(fetchedUserData);
        setPointRule(fetchedUserData.pointAcquisitionRule || 'all');
        if (fetchedUserData.pixelAvatar) {
            try {
                setCurrentPixelAvatar(JSON.parse(fetchedUserData.pixelAvatar));
            } catch (e) {
                console.error("Error parsing pixelAvatar:", e);
                setCurrentPixelAvatar(null);
            }
        } else {
            setCurrentPixelAvatar(null);
        }
        setEditName(fetchedUserData.name || '');
        setEditNickname(fetchedUserData.displayName);
        setEditSchoolName(fetchedUserData.schoolName || '');
        if (fetchedUserData.role === 'teacher') {
          setClassCode(fetchedUserData.classCode || '');
        }
        const currentLevel = getLevelInfo(fetchedUserData.xp);
        setLevelInfo(currentLevel);
        setNextLevelInfo(getNextLevelInfo(currentLevel.level));
      }

      setReviewQuestions(incorrectSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as IncorrectAnswer)));
      setSolvedReviewQuestions(solvedIncorrectSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as SolvedIncorrectAnswer)));
      setSubjectStats(transformStats(subjectStatsSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as SubjectStat))));
      
      const gameSets = myGameSetsSnapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as GameSet));
      // @ts-ignore: 빌드 에러를 해결하기 위해 다음 라인의 타입 체크를 건너뜁니다.
      gameSets.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setMyGameSets(gameSets);

      const ids = new Set<string>();
      playedSetsSnapshot.docs.forEach((doc: QueryDocumentSnapshot) => {
        const data = doc.data() as PlayedGameSet;
        if (data.gameSetId) {
          ids.add(data.gameSetId);
        }
      });
      setPlayedGameSetIds(ids);
      
      const submissions = writingSubmissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WritingSubmission));
      setWritingSubmissions(submissions);

    } catch (error) {
        console.error("Error fetching profile data:", error);
        toast({ variant: 'destructive', title: '오류', description: '프로필 데이터를 불러오는 중 오류가 발생했습니다.' });
    } finally {
        setIsLoading(false);
        setIsLoadingMyGameSets(false);
    }
  }, [user, toast]);

  const fetchClassmates = useCallback(async () => {
    if (!user || !userData) {
      setClassmates([]);
      return;
    }
  
    try {
      const members: User[] = [];
      const isTeacher = userData.role === 'teacher';
      const classIdForQuery = isTeacher ? user.uid : userData.classId;
  
      if (classIdForQuery) {
        const classmatesQuery = query(
          collection(db, 'users'),
          where('classId', '==', classIdForQuery)
        );
        
        const classmatesSnapshot = await getDocs(classmatesQuery);
        const studentMembers = classmatesSnapshot.docs
          .map(doc => doc.data() as User)
          .filter(member => member.uid !== user.uid); 
        members.push(...studentMembers);
  
        if (!isTeacher && userData.classId) {
          const teacherRef = doc(db, 'users', userData.classId);
          const teacherSnap = await getDoc(teacherRef);
          if (teacherSnap.exists()) {
            members.push(teacherSnap.data() as User);
          }
        }
      }
      
      setClassmates(members.map(member => ({
        value: member.uid,
        label: `${member.name || member.displayName} ${member.role === 'teacher' ? '(선생님)' : ''}`.trim(),
      })));
  
    } catch (error) {
      console.error("Error fetching classmates:", error);
      toast({ variant: 'destructive', title: '오류', description: '학급 구성원 목록을 불러오는 데 실패했습니다.' });
    }
  }, [user, userData, toast]);


  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  useEffect(() => {
    if (userData) {
      fetchClassmates();
    }
  }, [userData, fetchClassmates]);
  
  useEffect(() => {
    const fetchPlayedSets = async () => {
        if (!user || playedGameSetIds.size === 0) {
            setPlayedGameSets([]);
            setIsLoadingPlayedGameSets(false);
            return;
        }

        setIsLoadingPlayedGameSets(true);
        try {
            const playedSetIds = Array.from(playedGameSetIds);
            const chunks: string[][] = [];
            for (let i = 0; i < playedSetIds.length; i += 30) {
                chunks.push(playedSetIds.slice(i, i + 30));
            }

            let fetchedGameSets: GameSet[] = [];
            for (const chunk of chunks) {
                if (chunk.length > 0) {
                    const q = query(collection(db, 'game-sets'), where('__name__', 'in', chunk));
                    const snapshot = await getDocs(q);
                    fetchedGameSets = [...fetchedGameSets, ...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSet))];
                }
            }
            
            const playedInfoQuery = query(collection(db, 'users', user.uid, 'playedGameSets'));
            const playedInfoSnapshot = await getDocs(playedInfoQuery);
            const playedInfo: Record<string, PlayedGameSet> = {};
            playedInfoSnapshot.forEach(doc => {
                const data = doc.data() as PlayedGameSet;
                if(data.gameSetId) {
                  playedInfo[data.gameSetId] = data;
                }
            });

            fetchedGameSets.sort((a, b) => {
                const timeA = playedInfo[a.id]?.playedAt?.toMillis() || 0;
                const timeB = playedInfo[b.id]?.playedAt?.toMillis() || 0;
                return timeB - timeA;
            });
            
            setPlayedGameSets(fetchedGameSets);
        } catch (error) {
            console.error('Error fetching played game sets:', error);
            toast({ variant: 'destructive', title: '오류', description: '플레이한 퀴즈 목록을 불러오는 중 오류가 발생했습니다.' });
        } finally {
            setIsLoadingPlayedGameSets(false);
        }
    };

    if (user) {
        fetchPlayedSets();
    }
  }, [playedGameSetIds, user, toast]);

  useEffect(() => {
    if (!previewGameSet) {
      setComments([]);
      return;
    }

    const commentsQuery = query(collection(db, 'game-sets', previewGameSet.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetComment));
      setComments(fetchedComments);
    });

    return () => unsubscribe();
  }, [previewGameSet]);

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

      const updater = (set: GameSet) => {
          if (set.id === gameSet.id) {
              return { ...set, likeCount: newLikeCount, likedBy: newLikedBy };
          }
          return set;
      };

      setMyGameSets(prev => prev.map(updater));
      setPlayedGameSets(prev => prev.map(updater));
      setPreviewGameSet(prev => (prev && prev.id === gameSet.id ? updater(prev) : prev));

    } catch (error) {
      console.error("Error liking game set:", error);
      toast({ variant: "destructive", title: "오류", description: "좋아요 처리 중 오류가 발생했습니다." });
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !user || !previewGameSet || !userData) return;

    setIsPostingComment(true);
    const gameSetRef = doc(db, 'game-sets', previewGameSet.id);
    const newCommentRef = doc(collection(gameSetRef, 'comments'));
    
    try {
       await runTransaction(db, async (transaction) => {
            const commentData = {
                id: newCommentRef.id,
                userId: user.uid,
                userNickname: userData.displayName,
                userAvatar: userData.pixelAvatar || null,
                comment: newComment,
                createdAt: serverTimestamp()
            };
            transaction.set(newCommentRef, commentData);
            transaction.update(gameSetRef, { commentCount: increment(1) });
       });

       setNewComment("");
       setPreviewGameSet(prev => prev ? { ...prev, commentCount: (prev.commentCount || 0) + 1 } : null);

    } catch (error) {
      console.error("Error posting comment: ", error);
      toast({ variant: "destructive", title: "오류", description: "댓글 작성 중 오류가 발생했습니다."});
    } finally {
      setIsPostingComment(false);
    }
  };


  const handleEdit = () => {
    if (!userData) return;
    setEditName(userData.name || '');
    setEditNickname(userData.displayName);
    setEditSchoolName(userData.schoolName || '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user || !userData) return;

    if (!editName.trim()) {
        toast({ variant: 'destructive', title: '오류', description: '이름(실명)을 입력해주세요.' });
        return;
    }
    if (!editNickname || editNickname.length < 2 || editNickname.length > 5) {
      toast({ variant: 'destructive', title: '오류', description: '닉네임은 2자 이상 5자 이하로 입력해주세요.'});
      return;
    }
    if (!editSchoolName) {
      toast({ variant: 'destructive', title: '오류', description: '학교 이름을 입력해주세요.'});
      return;
    }

    try {
      await updateProfile(user, { displayName: editNickname });

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        name: editName,
        displayName: editNickname,
        schoolName: editSchoolName,
      });
      
      setUserData(prev => prev ? {...prev, name: editName, displayName: editNickname, schoolName: editSchoolName} : null);
      setIsEditing(false);
      toast({ title: '성공', description: '프로필이 성공적으로 업데이트되었습니다.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: '오류', description: `프로필 업데이트 중 오류가 발생했습니다: ${error.message}`});
    }
  };

  const handleSwitchToTeacher = async () => {
      if (teacherCode !== 'indischool') {
          toast({ variant: 'destructive', title: '코드 오류', description: '코드가 올바르지 않습니다.'});
          return;
      }
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { role: 'teacher' });
        setUserData(prev => prev ? {...prev, role: 'teacher'} : null);
        toast({ title: '성공', description: '교사 계정으로 전환되었습니다.'});
        setIsTeacherDialog(false);
        setTeacherCode('');
      }
  }

  const handleSetClassCode = async () => {
    if (!classCode || classCode.length < 4) {
      toast({ variant: 'destructive', title: '오류', description: '학급 코드는 4자 이상이어야 합니다.' });
      return;
    }
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { classCode: classCode });
      setUserData(prev => prev ? {...prev, classCode: classCode} : null);
      toast({ title: '성공', description: '학급 코드가 설정되었습니다.' });
      setIsClassCodeDialog(false);
    }
  }
  
  const handleJoinClass = async () => {
    if (!joinClassCode) {
      toast({ variant: 'destructive', title: '오류', description: '학급 코드를 입력해주세요.' });
      return;
    }

    if (user) {
        const q = query(collection(db, 'users'), where('classCode', '==', joinClassCode), where('role', '==', 'teacher'), limit(1));
        const teacherSnapshot = await getDocs(q);

        if (teacherSnapshot.empty) {
            toast({ variant: 'destructive', title: '오류', description: '존재하지 않는 학급 코드입니다.' });
            return;
        }

        const teacherDoc = teacherSnapshot.docs[0];
        const teacherId = teacherDoc.id;

        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { classId: teacherId }); 
        
        setUserData(prev => prev ? {...prev, classId: teacherId} : null);
        toast({ title: '성공', description: `'${teacherDoc.data().name || teacherDoc.data().displayName} 선생님'의 학급에 참여했습니다.` });
        setIsJoinClassDialog(false);
        setJoinClassCode('');
    }
  };
  
  const handleLeaveClass = async () => {
    if (!user || userData?.role === 'teacher') return;
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { classId: null });
      setUserData(prev => prev ? {...prev, classId: undefined } : null);
      toast({ title: '학급 탈퇴', description: '학급에서 성공적으로 탈퇴했습니다.' });
      setIsLeaveClassDialogOpen(false);
    } catch(error) {
      toast({ variant: 'destructive', title: '오류', description: '학급 탈퇴 중 오류가 발생했습니다.' });
      console.error('Error leaving class:', error);
    }
  };


  const availableUnits = useMemo(() => {
    if (selectedSubject === 'all') {
      return [];
    }
    const subject = subjectStats.find(s => s.id === selectedSubject);
    const units = subject?.units ? Object.keys(subject.units) : [];
    return units;
  }, [selectedSubject, subjectStats]);

  useEffect(() => {
    setSelectedUnit('all');
  }, [selectedSubject]);
  
  const overallAccuracy = useMemo(() => {
    let totalCorrect = 0;
    let totalIncorrect = 0;
    subjectStats.forEach(stat => {
      totalCorrect += stat.totalCorrect || 0;
      totalIncorrect += stat.totalIncorrect || 0;
    });
    const total = totalCorrect + totalIncorrect;
    return total > 0 ? ((totalCorrect / total) * 100).toFixed(1) : '0.0';
  }, [subjectStats]);

  const { filteredCorrect, filteredIncorrect, filteredAccuracy } = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    
    if (selectedSubject === 'all') {
      subjectStats.forEach(stat => {
        correct += stat.totalCorrect || 0;
        incorrect += stat.totalIncorrect || 0;
      });
    } else {
      const subject = subjectStats.find(s => s.id === selectedSubject);
      if (subject) {
        if (selectedUnit === 'all') {
          correct = subject.totalCorrect || 0;
          incorrect = subject.totalIncorrect || 0;
        } else {
          if (subject.units && subject.units[selectedUnit]) {
            correct = subject.units[selectedUnit].totalCorrect || 0;
            incorrect = subject.units[selectedUnit].totalIncorrect || 0;
          }
        }
      }
    }

    const total = correct + incorrect;
    const acc = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';
    
    return { filteredCorrect: correct, filteredIncorrect: incorrect, filteredAccuracy: acc };
  }, [subjectStats, selectedSubject, selectedUnit]);


  const handleReviewAnswerChange = (index: number, value: string) => {
    const updatedQuestions = [...reviewQuestions];
    updatedQuestions[index].userReviewAnswer = value;
    setReviewQuestions(updatedQuestions);
  };

  const checkAnswer = (question: Question, userAnswer: string) => {
    if (question.type === 'subjective') {
      return userAnswer.trim().toLowerCase() === question.answer?.trim().toLowerCase();
    }
    return userAnswer === question.correctAnswer;
  };

  const handleSubmitReview = async (index: number) => {
    const updatedQuestions = [...reviewQuestions];
    const reviewItem = updatedQuestions[index];

    if (!user || !reviewItem.userReviewAnswer) {
      toast({ variant: 'destructive', title: '오류', description: '답변을 입력하거나 선택해주세요.' });
      return;
    }

    updatedQuestions[index].isSubmitting = true;
    setReviewQuestions(updatedQuestions);

    const isCorrect = checkAnswer(reviewItem.question, reviewItem.userReviewAnswer);
    
    try {
        const solvedDocRef = doc(db, 'users', user.uid, 'solved-incorrect-answers', reviewItem.id);
        const solvedData: SolvedIncorrectAnswer = {
            ...reviewItem,
            reviewAnswer: reviewItem.userReviewAnswer,
            wasReviewCorrect: isCorrect,
            reviewedAt: serverTimestamp(),
        };
        await setDoc(solvedDocRef, solvedData);

        await deleteDoc(doc(db, 'users', user.uid, 'incorrect-answers', reviewItem.id));

        if (isCorrect) {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { xp: increment(10), classPoints: increment(10) });
            setUserData(prev => prev ? {...prev, xp: prev.xp + 10, classPoints: (prev.classPoints || 0) + 10} : null);
            toast({ title: '정답입니다!', description: '복습을 완료했습니다. 10 XP와 10 학급 포인트를 획득했습니다!' });
        } else {
             toast({ variant: 'destructive', title: '아쉽지만 오답입니다.', description: `정답은 "${reviewItem.question.answer || reviewItem.question.correctAnswer}" 입니다.` });
        }
        
        setReviewQuestions(prev => prev.filter((_, i) => i !== index));
        setSolvedReviewQuestions(prev => [solvedData, ...prev]);

    } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: `답변 제출 중 오류가 발생했습니다: ${error.message}` });
        const revertedQuestions = [...reviewQuestions];
        if (revertedQuestions[index]) {
            revertedQuestions[index].isSubmitting = false;
        }
        setReviewQuestions(revertedQuestions);
    }
  };

  const handleShowIncorrectAnswers = () => {
    let filtered = solvedReviewQuestions;

    if (selectedSubject !== 'all') {
      filtered = filtered.filter(q => q.question.subject === selectedSubject);
    }
    if (selectedUnit !== 'all') {
      filtered = filtered.filter(q => q.question.unit === selectedUnit);
    }
    
    setIncorrectAnswersToShow(filtered);
    setShowIncorrectAnswersDialog(true);
  };
  
  const handleOpenSendPointsDialog = useCallback(() => {
    setIsSendPointsDialogOpen(true);
  }, []);

  const handleSendPoints = async () => {
    if (!user || !userData || !sendPointsRecipient || sendPointsAmount <= 0) {
      toast({ variant: 'destructive', title: '오류', description: '받는 사람과 보낼 금액을 확인해주세요.' });
      return;
    }
    if (sendPointsAmount > (userData.classPoints || 0)) {
        toast({ variant: 'destructive', title: '오류', description: '보유한 학급 포인트가 부족합니다.'});
        return;
    }

    setIsSendingPoints(true);
    const recipientName = classmates.find(c => c.value === sendPointsRecipient)?.label || '친구';
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user.uid);
        const recipientRef = doc(db, 'users', sendPointsRecipient);

        const [senderDoc, recipientDoc] = await Promise.all([
          transaction.get(senderRef),
          transaction.get(recipientRef)
        ]);

        if (!senderDoc.exists() || !recipientDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";

        const senderData = senderDoc.data();
        if ((senderData.classPoints || 0) < sendPointsAmount) {
          throw "보유한 학급 포인트가 부족합니다.";
        }
        
        transaction.update(senderRef, { classPoints: increment(-sendPointsAmount) });
        const senderLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(senderLogRef, {
            id: senderLogRef.id,
            userId: user.uid,
            type: 'SEND_POINTS',
            amount: -sendPointsAmount,
            timestamp: serverTimestamp(),
            description: `${recipientName}에게 보내기`,
            relatedUserId: sendPointsRecipient,
        } as PointLog);
        
        transaction.update(recipientRef, { classPoints: increment(sendPointsAmount) });
        const recipientLogRef = doc(collection(db, 'users', sendPointsRecipient, 'pointLogs'));
        transaction.set(recipientLogRef, {
            id: recipientLogRef.id,
            userId: sendPointsRecipient,
            type: 'RECEIVE_POINTS',
            amount: sendPointsAmount,
            timestamp: serverTimestamp(),
            description: `${userData.displayName}에게서 받기`,
            relatedUserId: user.uid,
        } as PointLog);

      });

      toast({ title: '전송 완료', description: `${recipientName}님에게 ${sendPointsAmount.toLocaleString()} 포인트를 성공적으로 보냈습니다.` });
      // Optimistic update
      setUserData(prev => prev ? {...prev, classPoints: (prev.classPoints || 0) - sendPointsAmount} : null);
      setIsSendPointsDialogOpen(false);
      setSendPointsAmount(0);
      setSendPointsRecipient('');

    } catch (error: any) {
      toast({ variant: "destructive", title: "전송 실패", description: typeof error === 'string' ? error : `포인트 전송 중 오류가 발생했습니다: ${error.message}`});
    } finally {
      setIsSendingPoints(false);
    }
  };

  const handleSaveAvatar = async (pixels: string[][]) => {
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.uid);
        const avatarString = JSON.stringify(pixels);
        await setDoc(userRef, { pixelAvatar: avatarString }, { merge: true });
        
        setCurrentPixelAvatar(pixels);
        setUserData(prev => {
            if (!prev) return null;
            return { ...prev, pixelAvatar: avatarString };
        });

        toast({ title: '성공', description: '프로필 이미지가 저장되었습니다.' });
        setIsAvatarEditorOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: `프로필 이미지 저장 중 오류가 발생했습니다: ${error.message}` });
        console.error("Avatar save error:", error);
    }
  };

  const handleSavePointRule = async () => {
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            pointAcquisitionRule: pointRule,
        });
        toast({ title: '저장 완료', description: '포인트 획득 규칙이 저장되었습니다.' });
        setIsPointManagementDialogOpen(false);
    } catch (error) {
        console.error('Error saving point rule:', error);
        toast({ variant: 'destructive', title: '오류', description: '규칙 저장 중 오류가 발생했습니다.'});
    }
  }

  const handleDeleteGameSet = async () => {
    if (!deleteCandidate) return;
    try {
        await deleteDoc(doc(db, "game-sets", deleteCandidate.id));
        setMyGameSets(prev => prev.filter(set => set.id !== deleteCandidate.id));
        toast({ title: "성공", description: "퀴즈 세트를 삭제했습니다." });
        setDeleteCandidate(null);
    } catch (error) {
        console.error("Error deleting document: ", error);
        toast({ variant: "destructive", title: "오류", description: "퀴즈 세트 삭제 중 오류가 발생했습니다." });
    }
  };
  
  const handleOpenPointHistory = async () => {
    if (!user) return;
    setIsPointHistoryOpen(true);
    setIsPointHistoryLoading(true);
    try {
      const logsQuery = query(collection(db, 'users', user.uid, 'pointLogs'), orderBy('timestamp', 'asc'));
      const logSnapshot = await getDocs(logsQuery);
      const logs = logSnapshot.docs.map(doc => doc.data() as PointLog);
      setPointLogs(logs);
    } catch (error) {
      console.error('Error fetching point logs:', error);
      toast({ variant: 'destructive', title: '오류', description: '포인트 내역을 불러오는 중 오류가 발생했습니다.'});
    } finally {
        setIsPointHistoryLoading(false);
    }
  }

  const handleOpenWritingTopicDialog = async () => {
    if (subjectStats.length === 0) {
      toast({
        variant: "destructive",
        title: "데이터 부족",
        description: "학습 기록이 부족하여 글쓰기 주제를 생성할 수 없습니다. 퀴즈를 더 풀어보세요.",
      });
      return;
    }
    setWritingTopic({
      isOpen: true,
      isLoading: true,
      isEvaluating: false,
      topic: null,
      prompt: null,
      response: "",
      evaluation: null,
    });
    try {
      const result = await generateWritingTopic({ subjectStats });
      setWritingTopic(prev => ({
        ...prev,
        isLoading: false,
        topic: result.topic,
        prompt: result.prompt,
      }));
    } catch (error) {
      console.error("Error generating writing topic:", error);
      toast({ variant: "destructive", title: "오류", description: "AI 주제 생성 중 오류가 발생했습니다." });
      setWritingTopic(prev => ({ ...prev, isOpen: false, isLoading: false }));
    }
  };

  const handleEvaluateWriting = async () => {
    if (!writingTopic.prompt || !writingTopic.topic || !writingTopic.response || !userData) return;

    setWritingTopic(prev => ({ ...prev, isEvaluating: true }));

    try {
      const evaluationResult = await evaluateWriting({
        prompt: writingTopic.prompt,
        userResponse: writingTopic.response,
        topic: writingTopic.topic,
        grade: userData.grade || "5학년", // Fallback grade
      });

      setWritingTopic(prev => ({ ...prev, isEvaluating: false, evaluation: evaluationResult }));
      
      const submission: Omit<WritingSubmission, 'id' | 'createdAt'> = {
        topic: writingTopic.topic,
        prompt: writingTopic.prompt,
        response: writingTopic.response,
        evaluation: evaluationResult,
      };

      if(user) {
        const submissionRef = doc(collection(db, 'users', user.uid, 'writingSubmissions'));
        await setDoc(submissionRef, {
            ...submission,
            id: submissionRef.id,
            createdAt: serverTimestamp(),
        });
        setWritingSubmissions(prev => [{...submission, id: submissionRef.id, createdAt: Timestamp.now() } as WritingSubmission, ...prev]);
      }
      
      toast({ title: "채점 완료!", description: `AI 평가 점수는 ${evaluationResult.score}점 입니다.` });

    } catch (error) {
      console.error("Error evaluating writing:", error);
      toast({ variant: "destructive", title: "오류", description: "글쓰기 채점 중 오류가 발생했습니다." });
      setWritingTopic(prev => ({ ...prev, isEvaluating: false }));
    }
  };


  const pointHistoryChartData = useMemo(() => {
    if (!isClient) return [];
    return pointLogs.reduce((acc, log) => {
        if (!log.timestamp) return acc;
        const date = format(new Date((log.timestamp as any)?.toDate()), 'yyyy-MM-dd');
        const lastEntry = acc[acc.length - 1];
        const newTotal = (lastEntry ? lastEntry.totalPoints : 0) + log.amount;

        if (lastEntry && lastEntry.date === date) {
        lastEntry.totalPoints = newTotal;
        } else {
        acc.push({ date, totalPoints: newTotal });
        }
        return acc;
    }, [] as { date: string; totalPoints: number }[]);
  }, [pointLogs, isClient]);

  const pointAnalysisData = useMemo(() => {
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    pointLogs.forEach(log => {
      if (log.amount > 0) {
        let category = "기타 수입";
        if (log.type === 'QUIZ_REWARD' || log.type === 'REVIEW_REWARD') category = "퀴즈/복습 보상";
        else if (log.type === 'ITEM_SALE') category = "아이템 판매";
        else if (log.type === 'RECEIVE_POINTS') category = "포인트 받기";
        else if (log.type === 'TEACHER_GRANT') category = "선생님 지급";
        else if (log.type === 'ITEM_REFUND_BUYER') category = "환불 받음";
        incomeByCategory[category] = (incomeByCategory[category] || 0) + log.amount;
      } else {
        let category = "기타 지출";
        if (log.type === 'ITEM_PURCHASE') category = "아이템 구매";
        else if (log.type === 'SEND_POINTS') category = "포인트 보내기";
        else if (log.type === 'TEACHER_DEDUCT') category = "선생님 회수";
        else if (log.type === 'ITEM_REFUND_SELLER') category = "환불 처리";
        expenseByCategory[category] = (expenseByCategory[category] || 0) + Math.abs(log.amount);
      }
    });

    const totalIncome = Object.values(incomeByCategory).reduce((sum, value) => sum + value, 0);
    const totalExpense = Object.values(expenseByCategory).reduce((sum, value) => sum + value, 0);

    const incomeChartData = Object.entries(incomeByCategory).map(([name, value]) => ({ name, value }));
    const expenseChartData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));

    return { totalIncome, totalExpense, incomeChartData, expenseChartData };
  }, [pointLogs]);


  const pointHistoryChartConfig = {
    totalPoints: {
      label: "누적 포인트",
      color: "hsl(var(--primary))",
    },
  };
  
  const COLORS = [
    "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))"
  ];
  
  const chartConfig: Record<string, { label: string; color?: string }> = { value: { label: "포인트" } };
  pointAnalysisData.incomeChartData.forEach((item, index) => {
    chartConfig[item.name as keyof typeof chartConfig] = { label: item.name, color: COLORS[index % COLORS.length] };
  });
  pointAnalysisData.expenseChartData.forEach((item, index) => {
    chartConfig[item.name as keyof typeof chartConfig] = { label: item.name, color: COLORS[index % COLORS.length] };
  });


  const xpForNextLevel = nextLevelInfo ? nextLevelInfo.xpThreshold - (levelInfo?.xpThreshold || 0) : 0;
  const currentXpProgress = userData ? userData.xp - (levelInfo?.xpThreshold || 0) : 0;
  const progressPercentage = xpForNextLevel > 0 ? (currentXpProgress / xpForNextLevel) * 100 : 100;

  const schoolInfo = [userData?.schoolName, userData?.grade && `${userData.grade}학년`, userData?.class && `${userData.class}반`].filter(Boolean).join(' ');

  if (!isClient || isLoading) {
    return (
        <div className="container mx-auto flex flex-col gap-8">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-20 w-20 rounded-lg" />
                        <div>
                           <Skeleton className="h-8 w-40 mb-2" />
                           <Skeleton className="h-5 w-32" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <Skeleton className="h-7 w-24 mx-auto mb-1" />
                            <Skeleton className="h-5 w-20 mx-auto" />
                        </div>
                        <div>
                            <Skeleton className="h-7 w-24 mx-auto mb-1" />
                            <Skeleton className="h-5 w-20 mx-auto" />
                        </div>
                        <div>
                            <Skeleton className="h-7 w-24 mx-auto mb-1" />
                            <Skeleton className="h-5 w-16 mx-auto" />
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><Skeleton className="h-8 w-32" /></CardHeader>
                <CardContent><Skeleton className="h-24 w-full" /></CardContent>
            </Card>
        </div>
    )
  }
  
  if (!user || !userData || !levelInfo) {
      return <div>사용자 정보를 불러올 수 없습니다.</div>
  }

  const canSendPoints = classmates.length > 0;
  const hasUserPlayedSelectedSet = previewGameSet ? playedGameSetIds.has(previewGameSet.id) : false;

  return (
    <TooltipProvider>
    <div className="container mx-auto flex flex-col gap-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="relative h-24 w-24 flex items-center justify-center rounded-lg bg-secondary flex-shrink-0 cursor-pointer group" onClick={() => setIsAvatarEditorOpen(true)}>
                <PixelAvatar pixels={currentPixelAvatar} className="w-full h-full" />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <Pencil className="w-8 h-8 text-white" />
                </div>
            </div>
            <div className="flex-grow">
              {isEditing ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="이름 (실명)" />
                  <Input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder="닉네임 (2-5자)" />
                  <Input value={editSchoolName} onChange={(e) => setEditSchoolName(e.target.value)} placeholder="학교 이름" />
                </div>
              ) : (
                <div>
                  <CardTitle className="font-headline text-3xl flex items-center gap-2">
                    {userData.displayName}
                    <span className="text-lg text-muted-foreground font-normal">({userData.name})</span>
                    {userData.role === 'teacher' && <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-1 rounded-full">교사</span>}
                  </CardTitle>
                  <CardDescription>{levelInfo.title}</CardDescription>
                  {schoolInfo && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                        <School className="w-4 h-4"/>
                        <span>{schoolInfo}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
                <div className="flex gap-2">
                    <Button size="icon" onClick={handleSave}><Save className="w-4 h-4"/></Button>
                    <Button size="icon" variant="ghost" onClick={handleCancel}><X className="w-4 h-4"/></Button>
                </div>
            ) : (
                <Button variant="ghost" size="icon" onClick={handleEdit}>
                    <Pencil className="w-4 h-4" />
                </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between items-end mb-1">
              <span className="text-sm font-medium">Lv. {levelInfo.level}</span>
              <span className="text-sm text-muted-foreground">
                {nextLevelInfo ? `${userData.xp.toLocaleString()} / ${nextLevelInfo.xpThreshold.toLocaleString()} XP` : '최고 레벨'}
              </span>
            </div>
            <Progress value={Math.max(0, progressPercentage)} className="h-3" />
             {nextLevelInfo && (
                <p className="text-xs text-right text-muted-foreground mt-1">
                    다음 레벨까지 {Math.max(0, nextLevelInfo.xpThreshold - userData.xp)} XP 남음
                </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{userData.xp.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">누적 포인트</p>
            </div>
            <div 
              className="flex flex-col items-center cursor-pointer group"
              onClick={handleOpenPointHistory}
            >
               <div className="group-hover:opacity-80">
                <p className="flex items-center justify-center text-2xl font-bold">
                    <Gem className="w-5 h-5 mr-1 text-blue-500"/>
                    {(userData.classPoints || 0).toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">학급 포인트</p>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1"
              >
                포인트 보기
              </Button>
            </div>
            <div>
              <p className="text-2xl font-bold">{overallAccuracy}%</p>
              <p className="text-sm text-muted-foreground">전체 정답률</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap gap-2">
             {userData.role === 'teacher' ? (
              <>
                <Button variant="outline" onClick={() => setIsClassCodeDialog(true)}>
                   <Edit className="mr-2 h-4 w-4"/> 학급 코드 관리
                </Button>
                 <Button variant="outline" onClick={() => setIsPointManagementDialogOpen(true)}>
                    <Settings className="mr-2 h-4 w-4"/> 학급 포인트 관리
                </Button>
              </>
            ) : (
              <>
                {userData.classId ? (
                   <Button variant="destructive" onClick={() => setIsLeaveClassDialogOpen(true)}>
                        <LogOut className="mr-2 h-4 w-4"/> 학급 탈퇴하기
                    </Button>
                ) : (
                    <Button variant="outline" onClick={() => setIsJoinClassDialog(true)}>
                        <Users className="mr-2 h-4 w-4"/> 학급 참여하기
                    </Button>
                )}
                <Button variant="outline" onClick={() => setIsTeacherDialog(true)}>
                    <KeyRound className="mr-2 h-4 w-4"/> 교사 계정으로 전환
                </Button>
              </>
            )}
        </CardFooter>
      </Card>
      
      <Tabs defaultValue="my-quizzes" className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="my-quizzes">내가 만든 퀴즈</TabsTrigger>
          <TabsTrigger value="played-quizzes">내가 풀었던 문제</TabsTrigger>
          <TabsTrigger value="achievement">과목별 성취도</TabsTrigger>
          <TabsTrigger value="review-notes">오답노트</TabsTrigger>
          <TabsTrigger value="writing-activity">글쓰기 활동</TabsTrigger>
        </TabsList>
        <TabsContent value="my-quizzes">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <BookOpen className="text-primary"/> 내가 만든 퀴즈
                    </CardTitle>
                    <CardDescription>
                        내가 직접 만든 퀴즈 목록입니다. 퀴즈를 수정하거나 삭제할 수 있습니다.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingMyGameSets ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
                    ) : myGameSets.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">아직 만든 퀴즈가 없습니다.</p>
                             <Button asChild className="mt-4">
                                <Link href="/game-sets/create">첫 번째 퀴즈 만들러 가기</Link>
                            </Button>
                        </div>
                    ) : (
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-2">
                                {myGameSets.map(set => (
                                    <Card key={set.id}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="font-headline text-lg truncate">{set.title}</CardTitle>
                                            <CardDescription>
                                                {set.questions.length} 문제 · {set.isPublic ? '공개' : '비공개'}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-3 gap-1 text-center text-sm text-muted-foreground py-2">
                                            <div className="flex items-center justify-center gap-1">
                                                <Users className="h-4 w-4"/>
                                                <span>활용 {set.playCount || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <ThumbsUp className="h-4 w-4"/>
                                                <span>{set.likeCount || 0}</span>
                                            </div>
                                            <div className="flex items-center justify-center gap-1">
                                                <MessageSquare className="h-4 w-4"/>
                                                <span>{set.commentCount || 0}</span>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="flex flex-wrap justify-end gap-2 pt-2">
                                            <Button variant="outline" size="sm" onClick={() => setPreviewGameSet(set)}>
                                                <Eye className="mr-2 h-4 w-4"/> 미리보기
                                            </Button>
                                            <Button variant="secondary" size="sm" asChild>
                                                <Link href={`/game-sets/edit/${set.id}`}>
                                                    <Pencil className="mr-2 h-4 w-4"/> 수정
                                                </Link>
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => setDeleteCandidate(set)}>
                                                <Trash2 className="mr-2 h-4 w-4"/> 삭제
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="played-quizzes">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <History className="text-primary"/> 내가 풀었던 문제
                    </CardTitle>
                    <CardDescription>
                        내가 플레이했던 퀴즈 목록입니다. 퀴즈에 대한 피드백을 남겨보세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingPlayedGameSets ? (
                        <div className="text-center py-8"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></div>
                    ) : playedGameSets.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">아직 플레이한 퀴즈가 없습니다.</p>
                            <Button asChild className="mt-4">
                                <Link href="/dashboard">퀴즈 풀러 가기</Link>
                            </Button>
                        </div>
                    ) : (
                        <ScrollArea className="h-96 pr-4">
                            <div className="space-y-2">
                                {playedGameSets.map(set => (
                                    <Card key={set.id}>
                                        <CardContent className="p-4 flex items-center justify-between gap-2">
                                            <div className="flex-grow overflow-hidden">
                                                <p className="font-semibold truncate">{set.title}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    제작자: {set.creatorNickname}
                                                </p>
                                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <ThumbsUp className="h-4 w-4" /> {set.likeCount || 0}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <MessageSquare className="h-4 w-4" /> {set.commentCount || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={() => setPreviewGameSet(set)}>
                                                <Edit className="mr-2 h-4 w-4"/> 피드백 남기기
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="achievement">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-2">
                        <BarChart2 className="text-primary"/> 과목별 성취도
                    </CardTitle>
                    <CardDescription>과목 및 단원별 정답률을 확인하고 약점을 보완해보세요.</CardDescription>
                </CardHeader>
                <CardContent>
                {subjectStats.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">아직 학습 기록이 없습니다. 퀴즈를 풀고 다시 확인해주세요!</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                            <SelectTrigger>
                                <SelectValue placeholder="과목 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 과목</SelectItem>
                                {subjectStats.map(stat => (
                                    <SelectItem key={stat.id} value={stat.id}>{stat.id}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={selectedUnit} onValueChange={setSelectedUnit} disabled={selectedSubject === 'all' || availableUnits.length === 0}>
                            <SelectTrigger>
                                <SelectValue placeholder="단원 선택" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체 단원</SelectItem>
                                {availableUnits.map(unit => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center p-4 bg-secondary rounded-lg">
                        <div>
                            <p className="text-2xl font-bold text-blue-600">{filteredCorrect}</p>
                            <p className="text-sm text-muted-foreground">정답</p>
                        </div>
                        <div className="cursor-pointer" onClick={handleShowIncorrectAnswers}>
                            <p className="text-2xl font-bold text-red-600">{filteredIncorrect}</p>
                            <p className="text-sm text-muted-foreground">오답</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-primary">{filteredAccuracy}%</p>
                            <p className="text-sm text-muted-foreground">정답률</p>
                        </div>
                    </div>
                    </div>
                )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="review-notes">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="font-headline flex items-center gap-2">
                                <FileWarning className="text-primary"/> 오답노트
                            </CardTitle>
                            <CardDescription>
                                틀렸던 문제들을 다시 풀어보고 점수를 만회하세요! 복습 효과를 높이기 위해 틀린 문제는 24시간 후에 공개됩니다.
                            </CardDescription>
                        </div>
                        <Button onClick={handleOpenWritingTopicDialog} variant="outline">
                            <Pencil className="mr-2 h-4 w-4"/> AI 주제 글쓰기
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {reviewQuestions.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg">
                            <p className="text-muted-foreground">복습할 문제가 없습니다. 완벽해요!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reviewQuestions.map((item, index) => {
                                const question = item.question;
                                return (
                                <div key={item.id} className="p-4 border rounded-lg bg-background shadow-sm space-y-3">
                                    <p className="font-semibold text-base whitespace-pre-wrap">{question.question}</p>
                                    
                                    {question.imageUrl && (
                                        <div className="mt-2 relative aspect-video">
                                            <Image src={question.imageUrl} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" />
                                        </div>
                                    )}

                                    {question.type === 'subjective' && (
                                        <Input 
                                            placeholder="정답을 입력하세요"
                                            value={item.userReviewAnswer || ''}
                                            onChange={(e) => handleReviewAnswerChange(index, e.target.value)}
                                            disabled={item.isSubmitting}
                                        />
                                    )}
                                    {question.type === 'multipleChoice' && question.options && (
                                        <RadioGroup 
                                            value={item.userReviewAnswer} 
                                            onValueChange={(value) => handleReviewAnswerChange(index, value)} 
                                            className="space-y-2" 
                                            disabled={item.isSubmitting}
                                        >
                                            {question.options.map((option, idx) => (
                                                <div key={idx} className="flex items-center space-x-2">
                                                    <RadioGroupItem value={option} id={`review-${item.id}-option-${idx}`} />
                                                    <Label htmlFor={`review-${item.id}-option-${idx}`} className="flex-1 p-3 rounded-md border hover:border-primary cursor-pointer">{option}</Label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    )}
                                    {question.type === 'ox' && (
                                        <RadioGroup 
                                            value={item.userReviewAnswer} 
                                            onValueChange={(value) => handleReviewAnswerChange(index, value)} 
                                            className="grid grid-cols-2 gap-4" 
                                            disabled={item.isSubmitting}
                                        >
                                            <Label htmlFor={`review-${item.id}-o`} className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", item.userReviewAnswer === 'O' && 'border-primary bg-primary/10')}>
                                                <RadioGroupItem value="O" id={`review-${item.id}-o`} className="sr-only"/>O
                                            </Label>
                                            <Label htmlFor={`review-${item.id}-x`} className={cn("p-4 border rounded-md text-center text-2xl font-bold cursor-pointer", item.userReviewAnswer === 'X' && 'border-primary bg-primary/10')}>
                                                <RadioGroupItem value="X" id={`review-${item.id}-x`} className="sr-only"/>X
                                            </Label>
                                        </RadioGroup>
                                    )}
                                    
                                    <Button onClick={() => handleSubmitReview(index)} disabled={item.isSubmitting || !item.userReviewAnswer} className="w-full">
                                        {item.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "제출"}
                                    </Button>
                                </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="writing-activity">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline flex items-center gap-2">
                  <Pencil className="text-primary" /> 글쓰기 활동
                </CardTitle>
                <CardDescription>
                  AI가 생성한 주제에 대해 작성했던 글과 평가 결과를 확인합니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {writingSubmissions.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">아직 글쓰기 활동 기록이 없습니다.</p>
                  </div>
                ) : (
                  <ScrollArea className="h-96 pr-4">
                    <div className="space-y-2">
                      {writingSubmissions.map(sub => (
                        <Card key={sub.id} className="cursor-pointer hover:bg-accent" onClick={() => setViewingWritingSubmission(sub)}>
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className='w-full'>
                              <p className="font-semibold">{sub.topic}</p>
                              {isClient && sub.createdAt && (
                                <p className="text-sm text-muted-foreground">{formatDistanceToNow(sub.createdAt.toDate(), { addSuffix: true, locale: ko })}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">{sub.evaluation.score}점</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>

    {/* Avatar Editor Dialog */}
    <Dialog open={isAvatarEditorOpen} onOpenChange={setIsAvatarEditorOpen}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>프로필 이미지 편집</DialogTitle>
                <DialogDescription>
                    나만의 픽셀 아바타를 만들어보세요.
                </DialogDescription>
            </DialogHeader>
            <PixelEditor
                initialPixels={currentPixelAvatar}
                onSave={handleSaveAvatar}
            />
        </DialogContent>
    </Dialog>

    {/* Send Points Dialog */}
    <Dialog open={isSendPointsDialogOpen} onOpenChange={setIsSendPointsDialogOpen}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
                <DialogTitle>학급 포인트 보내기</DialogTitle>
                <DialogDescription>
                    학급 친구에게 포인트를 보낼 수 있습니다.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                 <div className="space-y-2">
                    <Label>받는 사람</Label>
                    <Combobox
                      options={classmates}
                      value={sendPointsRecipient}
                      onValueChange={setSendPointsRecipient}
                      placeholder="학급 친구 또는 선생님 선택..."
                      searchPlaceholder="이름으로 검색..."
                      notFoundMessage="해당하는 사용자가 없습니다."
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="points-amount">보낼 금액</Label>
                    <Input 
                        id="points-amount"
                        type="number"
                        min="1"
                        max={userData.classPoints || 0}
                        value={sendPointsAmount}
                        onChange={(e) => setSendPointsAmount(parseInt(e.target.value) || 0)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={() => setIsSendPointsDialogOpen(false)}>취소</Button>
                <Button onClick={handleSendPoints} disabled={isSendingPoints || !sendPointsRecipient || sendPointsAmount <= 0 || sendPointsAmount > (userData.classPoints || 0)}>
                    {isSendingPoints && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    보내기
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    {/* Point History Dialog */}
    <Dialog open={isPointHistoryOpen} onOpenChange={setIsPointHistoryOpen}>
       <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>포인트 활동 내역</DialogTitle>
          <DialogDescription>
            나의 학급 포인트 획득 및 사용 내역입니다.
          </DialogDescription>
        </DialogHeader>
        {isPointHistoryLoading ? (
            <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin"/></div>
        ) : pointLogs.length > 0 ? (
            <Tabs defaultValue="overview">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">누적 추이</TabsTrigger>
                <TabsTrigger value="analysis">수입/지출 분석</TabsTrigger>
                <TabsTrigger value="history">상세 내역</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <ChartContainer config={pointHistoryChartConfig} className="h-64 w-full">
                  <AreaChart data={pointHistoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area dataKey="totalPoints" type="monotone" fill="var(--color-totalPoints)" fillOpacity={0.4} stroke="var(--color-totalPoints)" />
                  </AreaChart>
                </ChartContainer>
              </TabsContent>
              <TabsContent value="analysis" className="mt-4">
                 <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg">수입/지출 요약</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className={cn("flex justify-between items-center p-3 rounded-lg cursor-pointer", chartView === 'income' ? 'bg-primary/10 border-primary border-2' : 'bg-secondary')} onClick={() => setChartView('income')}>
                                <span className="font-medium">총 수입</span>
                                <span className="font-bold text-green-600">+{pointAnalysisData.totalIncome.toLocaleString()}</span>
                            </div>
                            <div className={cn("flex justify-between items-center p-3 rounded-lg cursor-pointer", chartView === 'expense' ? 'bg-destructive/10 border-destructive border-2' : 'bg-secondary')} onClick={() => setChartView('expense')}>
                                <span className="font-medium">총 지출</span>
                                <span className="font-bold text-red-600">-{pointAnalysisData.totalExpense.toLocaleString()}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="md:col-span-3">
                        <CardHeader>
                            <CardTitle className="text-lg">{chartView === 'income' ? '수입' : '지출'} 항목 비율</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {(chartView === 'income' ? pointAnalysisData.incomeChartData.length > 0 : pointAnalysisData.expenseChartData.length > 0) ? (
                                <ChartContainer config={chartConfig} className="h-48 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                                            <Pie 
                                                data={chartView === 'income' ? pointAnalysisData.incomeChartData : pointAnalysisData.expenseChartData} 
                                                dataKey="value" 
                                                nameKey="name" 
                                                cx="50%" 
                                                cy="50%" 
                                                outerRadius={60} 
                                                strokeWidth={2}
                                            >
                                                {(chartView === 'income' ? pointAnalysisData.incomeChartData : pointAnalysisData.expenseChartData).map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Legend
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                iconType="circle"
                                                content={({ payload }) => (
                                                    <div className="text-xs space-y-1">
                                                        {payload?.map((entry, index) => (
                                                            <div key={`item-${index}`} className="flex items-center">
                                                                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
                                                                <span>{entry.value} ({(((entry.payload as any)?.percent ?? 0) * 100).toFixed(0)}%)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </ChartContainer>
                            ) : (
                                <div className="text-center text-muted-foreground py-16">{chartView === 'income' ? '수입' : '지출'} 내역이 없습니다.</div>
                            )}
                        </CardContent>
                    </Card>
                 </div>
              </TabsContent>
              <TabsContent value="history" className="mt-4">
                 <ScrollArea className="h-72">
                    <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>시간</TableHead>
                            <TableHead>내용</TableHead>
                            <TableHead className="text-right">포인트</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {[...pointLogs].reverse().map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="text-xs">{isClient && log.timestamp ? format(new Date((log.timestamp as any)?.toDate()), 'yyyy.MM.dd HH:mm', { locale: ko }) : ''}</TableCell>
                                <TableCell>{log.description}</TableCell>
                                <TableCell className={cn("text-right font-semibold", log.amount > 0 ? "text-green-600" : "text-red-600")}>
                                {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </ScrollArea>
              </TabsContent>
            </Tabs>
        ) : (
            <div className="text-center py-10 text-muted-foreground">포인트 활동 내역이 없습니다.</div>
        )}
        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => { setIsPointHistoryOpen(false); handleOpenSendPointsDialog(); }} disabled={!canSendPoints}>
            <Send className="mr-2 h-4 w-4" /> 포인트 보내기
          </Button>
        </DialogFooter>
       </DialogContent>
    </Dialog>


    {/* Incorrect Answers Dialog */}
    <Dialog open={showIncorrectAnswersDialog} onOpenChange={setShowIncorrectAnswersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>오답 기록 확인하기</DialogTitle>
            <DialogDescription>
              {selectedUnit !== 'all' ? `"${selectedUnit}" 단원에서 ` : selectedSubject !== 'all' ? `"${selectedSubject}" 과목에서 ` : '전체 과목에서 '}
              틀린 문제 목록입니다.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4">
              {incorrectAnswersToShow.length > 0 ? (
                incorrectAnswersToShow.map(item => (
                  <div key={item.id} className="p-4 rounded-md border bg-muted/50 space-y-2">
                    {item.question.imageUrl && (
                        <div className="relative aspect-video">
                            <Image src={item.question.imageUrl} alt="질문 이미지" fill className="rounded-md object-contain" />
                        </div>
                    )}
                    <p className="font-semibold whitespace-pre-wrap">{item.question.question}</p>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span>정답: <span className="font-medium">{item.question.answer || item.question.correctAnswer}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span>내 오답: <span className="font-medium">{item.userAnswer}</span></span>
                      </div>
                       <div className="flex items-center gap-2">
                            {item.wasReviewCorrect ? <CheckCircle className="w-4 h-4 text-blue-600" /> : <XCircle className="w-4 h-4 text-orange-500" />}
                            <span>복습 시 답변: <span className="font-medium">{item.reviewAnswer}</span></span>
                        </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-center py-8">이 범위에서 복습한 오답 기록이 없습니다.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
    </Dialog>
    
    {/* My Game Set Preview Dialog */}
    {previewGameSet && (
        <Dialog open={!!previewGameSet} onOpenChange={() => setPreviewGameSet(null)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{previewGameSet.title}</DialogTitle>
                    <DialogDescription>{[previewGameSet.grade, previewGameSet.semester, previewGameSet.subject, previewGameSet.unit].filter(Boolean).join(' / ')}</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="questions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="questions"><BookOpen className="mr-2 h-4 w-4"/>문제 목록</TabsTrigger>
                    <TabsTrigger value="comments"><MessageSquare className="mr-2 h-4 w-4"/>댓글 ({comments.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="questions">
                    <ScrollArea className="h-96 pr-4">
                        <div className="space-y-4">
                            {previewGameSet.questions.map((q, index) => (
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
                                      {isClient && comment.createdAt && (
                                        <span className="text-xs text-muted-foreground">
                                          {formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: ko })}
                                        </span>
                                      )}
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
                           <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => previewGameSet && handleLike(previewGameSet)}>
                                <ThumbsUp className={cn("mr-2 h-4 w-4", (previewGameSet.likedBy || []).includes(user.uid) && "fill-primary text-primary-foreground")} />
                                  좋아요 {previewGameSet.likeCount || 0}
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
            </DialogContent>
        </Dialog>
    )}

    {/* Delete Game Set Confirmation */}
    <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    "{deleteCandidate?.title}" 퀴즈 세트를 삭제하면 되돌릴 수 없습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteGameSet} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    {/* Dialogs for class and teacher management */}
    <AlertDialog open={isTeacherDialog} onOpenChange={setIsTeacherDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>교사 계정으로 전환</AlertDialogTitle>
            <AlertDialogDescription>
              교사 계정으로 전환하려면 관리자로부터 받은 코드를 입력하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input 
                placeholder="전환 코드 입력"
                value={teacherCode}
                onChange={(e) => setTeacherCode(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSwitchToTeacher}>전환하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={isClassCodeDialog} onOpenChange={setIsClassCodeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>학급 코드 관리</AlertDialogTitle>
            <AlertDialogDescription>
              학생들이 학급에 참여할 수 있도록 코드를 설정하거나 변경하세요. (최소 4자 이상)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input 
                placeholder="학급 코드 입력"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleSetClassCode}>저장하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

     <Dialog open={isPointManagementDialogOpen} onOpenChange={setIsPointManagementDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>학급 포인트 관리</DialogTitle>
                <DialogDescription>학생들의 학급 포인트 획득 규칙을 설정합니다.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <RadioGroup value={pointRule} onValueChange={(value: 'teacher_only' | 'class_only' | 'all') => setPointRule(value)}>
                    <div className="space-y-1 rounded-md border p-3">
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="teacher_only" id="teacher_only" />
                            <Label htmlFor="teacher_only" className="font-medium">
                                우리 학급 교사가 만든 퀴즈만
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                            학생들은 현재 학급의 선생님이 만든 퀴즈를 플레이할 때만 학급 포인트를 얻습니다.
                        </p>
                    </div>
                    <div className="space-y-1 rounded-md border p-3">
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="class_only" id="class_only" />
                            <Label htmlFor="class_only" className="font-medium">
                                우리 학급 구성원이 만든 모든 퀴즈
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                            학생들은 같은 학급의 교사 또는 다른 학생들이 만든 퀴즈를 플레이할 때 학급 포인트를 얻습니다.
                        </p>
                    </div>
                    <div className="space-y-1 rounded-md border p-3">
                       <div className="flex items-center gap-2">
                            <RadioGroupItem value="all" id="all" />
                            <Label htmlFor="all" className="font-medium">
                                모든 퀴즈
                            </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                            학생들은 플랫폼에 있는 모든 공개 퀴즈를 플레이할 때 학급 포인트를 얻습니다.
                        </p>
                    </div>
                </RadioGroup>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsPointManagementDialogOpen(false)}>취소</Button>
                <Button onClick={handleSavePointRule}>저장</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>

    <AlertDialog open={isJoinClassDialog} onOpenChange={setIsJoinClassDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>학급 참여하기</AlertDialogTitle>
            <AlertDialogDescription>
              선생님께 받은 학급 코드를 입력하여 학급에 참여하세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input 
                placeholder="학급 코드 입력"
                value={joinClassCode}
                onChange={(e) => setJoinClassCode(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleJoinClass}>참여하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    <AlertDialog open={isLeaveClassDialogOpen} onOpenChange={setIsLeaveClassDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말 학급에서 탈퇴하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    학급에서 나가면 더 이상 학급 랭킹과 매점을 이용할 수 없습니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveClass} className="bg-destructive hover:bg-destructive/90">탈퇴하기</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    {/* AI Writing Topic Dialog */}
    <Dialog open={writingTopic.isOpen} onOpenChange={(isOpen) => !isOpen && setWritingTopic(prev => ({...prev, isOpen: false}))}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>AI 주제 글쓰기</DialogTitle>
          <DialogDescription>
            AI가 나의 학습 기록을 분석하여 취약한 부분에 대한 글쓰기 주제를 만들어주었습니다.
          </DialogDescription>
        </DialogHeader>
        {writingTopic.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : writingTopic.evaluation ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-4">
                <div className="text-center">
                    <p className="text-sm text-muted-foreground">총점</p>
                    <p className="text-5xl font-bold text-primary">{writingTopic.evaluation.score}</p>
                </div>
                 <Card>
                    <CardHeader><CardTitle className="text-lg">글쓰기 주제</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap">{writingTopic.prompt}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-lg">내 답안</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-4 rounded-md">{writingTopic.response}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-lg">AI 종합 평가</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm">{writingTopic.evaluation.finalFeedback}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-lg">내용 타당성</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm">{writingTopic.evaluation.contentFeedback}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-lg">논리적 구조</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm">{writingTopic.evaluation.organizationFeedback}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-lg">표현의 적절성</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm">{writingTopic.evaluation.expressionFeedback}</p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-lg">AI 교정 답안</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-4 rounded-md">{writingTopic.evaluation.correctedText}</p>
                    </CardContent>
                </Card>
            </div>
          </ScrollArea>
        ) : (
          <div className="space-y-4 py-4">
            <div>
              <Label className="font-semibold text-base">주제: {writingTopic.topic}</Label>
              <p className="p-4 bg-secondary rounded-md mt-2 text-sm">{writingTopic.prompt}</p>
            </div>
            <Textarea
              value={writingTopic.response}
              onChange={(e) => setWritingTopic(prev => ({ ...prev, response: e.target.value }))}
              placeholder="여기에 글을 작성해주세요."
              rows={10}
              className="text-base"
              disabled={writingTopic.isEvaluating}
            />
          </div>
        )}
        <DialogFooter>
          {writingTopic.evaluation ? (
            <Button onClick={() => setWritingTopic(prev => ({...prev, isOpen: false}))}>닫기</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setWritingTopic(prev => ({...prev, isOpen: false}))}>취소</Button>
              <Button onClick={handleEvaluateWriting} disabled={writingTopic.isEvaluating || !writingTopic.response}>
                {writingTopic.isEvaluating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                채점 받기
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {viewingWritingSubmission && (
      <Dialog open={!!viewingWritingSubmission} onOpenChange={() => setViewingWritingSubmission(null)}>
        <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
                <DialogTitle>AI 글쓰기 평가 결과</DialogTitle>
                <DialogDescription>
                    주제: {viewingWritingSubmission?.topic}
                </DialogDescription>
            </DialogHeader>
            {viewingWritingSubmission?.evaluation ? (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-6 py-4">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">총점</p>
                        <p className="text-5xl font-bold text-primary">{viewingWritingSubmission.evaluation.score}</p>
                    </div>
                    <Card>
                        <CardHeader><CardTitle className="text-lg">글쓰기 주제</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap">{viewingWritingSubmission.prompt}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-lg">학생 답안</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-4 rounded-md">{viewingWritingSubmission.response}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-lg">AI 종합 평가</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm">{viewingWritingSubmission.evaluation.finalFeedback}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-lg">내용 타당성</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm">{viewingWritingSubmission.evaluation.contentFeedback}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-lg">논리적 구조</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm">{viewingWritingSubmission.evaluation.organizationFeedback}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle className="text-lg">표현의 적절성</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm">{viewingWritingSubmission.evaluation.expressionFeedback}</p>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-lg">AI 교정 답안</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm whitespace-pre-wrap bg-secondary/50 p-4 rounded-md">{viewingWritingSubmission.evaluation.correctedText}</p>
                        </CardContent>
                    </Card>
                </div>
              </ScrollArea>
            ) : (
                <div className="text-center py-10">평가 정보가 없습니다.</div>
            )}
        </DialogContent>
      </Dialog>
    )}
    </TooltipProvider>
  );
}

