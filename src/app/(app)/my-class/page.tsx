

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
  increment,
  getDocs,
  getDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import type { User, ClassStoreItem, PointLog, GameSet, PlayedGameSet, SubjectStat, SolvedIncorrectAnswer, GameSetComment } from '@/lib/types';
import { getLevelInfo, getNextLevelInfo, LevelInfo, levelSystem } from '@/lib/level-system';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  School,
  Users,
  Crown,
  Store,
  Banknote,
  ShoppingBag,
  Gift,
  Send,
  BarChart,
  PieChart as PieChartIcon,
  Wallet,
  Trophy,
  BookOpen,
  History,
  BarChart2,
  FileWarning,
  CheckCircle,
  XCircle,
  MessageSquare,
  ThumbsUp,
} from 'lucide-react';
import Link from 'next/link';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { Tooltip as UITooltip, TooltipContent as UITooltipContent, TooltipProvider, TooltipTrigger as UITooltipTrigger } from '@/components/ui/tooltip';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';


const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))"
];

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
        if (calculateSimilarity(unitName, group[0]) > 70) {
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


export default function MyClassPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [classmates, setClassmates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Teacher-specific state
  const [classStoreItems, setClassStoreItems] = useState<ClassStoreItem[]>([]);
  const [showBulkPointDialog, setShowBulkPointDialog] = useState(false);
  const [showBulkItemDialog, setShowBulkItemDialog] = useState(false);
  const [bulkPointAmount, setBulkPointAmount] = useState(0);
  const [bulkPointReason, setBulkPointReason] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<
    Record<string, boolean>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItemForBulkSend, setSelectedItemForBulkSend] = useState('');
  const [bulkItemQuantity, setBulkItemQuantity] = useState(1);
  const { toast } = useToast();

  // Analytics State
  const [analyticsMode, setAnalyticsMode] = useState<'students' | 'points' | 'items' | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [pointAnalysisData, setPointAnalysisData] = useState<any | null>(null);
  const [itemSalesData, setItemSalesData] = useState<any[]>([]);

  // Student Profile View State
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [studentProfileData, setStudentProfileData] = useState<{
    myGameSets: GameSet[];
    playedGameSets: GameSet[];
    subjectStats: SubjectStat[];
    solvedReviewQuestions: SolvedIncorrectAnswer[];
    levelInfo: LevelInfo | null;
    nextLevelInfo: LevelInfo | null;
  } | null>(null);
  const [isStudentProfileLoading, setIsStudentProfileLoading] = useState(false);
  const [studentSelectedSubject, setStudentSelectedSubject] = useState('all');
  const [studentSelectedUnit, setStudentSelectedUnit] = useState('all');
  const [showStudentIncorrectAnswersDialog, setShowStudentIncorrectAnswersDialog] = useState(false);
  const [studentIncorrectAnswersToShow, setStudentIncorrectAnswersToShow] = useState<SolvedIncorrectAnswer[]>([]);
  const [studentQuizPreview, setStudentQuizPreview] = useState<GameSet | null>(null);
  const [studentQuizComments, setStudentQuizComments] = useState<GameSetComment[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!studentQuizPreview) {
      setStudentQuizComments([]);
      return;
    }

    const commentsQuery = query(collection(db, 'game-sets', studentQuizPreview.id, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSetComment));
      setStudentQuizComments(fetchedComments);
    }, (error) => {
      console.error("Error fetching comments for student quiz preview:", error);
    });

    return () => unsubscribe();
  }, [studentQuizPreview]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setUserData(doc.data() as User);
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubUser();
  }, [user]);

  useEffect(() => {
    if (!userData) return;

    const targetClassId =
      userData.role === 'teacher' ? userData.uid : userData.classId;

    if (!targetClassId) {
      setIsLoading(false);
      return;
    }

    // Fetch teacher data
    const teacherId =
      userData.role === 'teacher' ? userData.uid : userData.classId;
    if (teacherId) {
      const unsubTeacher = onSnapshot(doc(db, 'users', teacherId), (doc) => {
        if (doc.exists()) {
          setTeacher(doc.data() as User);
        }
      });

      // Fetch classmates data
      const classmatesQuery = query(
        collection(db, 'users'),
        where('classId', '==', targetClassId)
      );
      const unsubClassmates = onSnapshot(classmatesQuery, (snapshot) => {
        const members = snapshot.docs.map((doc) => doc.data() as User);
        setClassmates(members.filter((m) => m.uid !== teacherId).sort((a,b) => (b.classPoints || 0) - (a.classPoints || 0)));
        setIsLoading(false);
      });

      // Fetch class store items if user is a teacher
      if (userData.role === 'teacher') {
        const itemsQuery = query(
          collection(db, 'class-store-items'),
          where('classId', '==', targetClassId)
        );
        const unsubItems = onSnapshot(itemsQuery, (snapshot) => {
          const items = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as ClassStoreItem)
          );
          setClassStoreItems(items);
        });
        return () => {
          unsubTeacher();
          unsubClassmates();
          unsubItems();
        };
      }

      return () => {
        unsubTeacher();
        unsubClassmates();
      };
    } else {
      setIsLoading(false);
    }
  }, [userData]);
  
  useEffect(() => {
    if (!viewingStudent) return;

    const fetchStudentProfile = async () => {
      setIsStudentProfileLoading(true);
      try {
        const studentId = viewingStudent.uid;
        const myGameSetsQuery = query(collection(db, 'game-sets'), where('creatorId', '==', studentId), where('isPublic', '==', true));
        const playedSetsQuery = query(collection(db, 'users', studentId, 'playedGameSets'));
        const subjectStatsRef = collection(db, 'users', studentId, 'subjectStats');
        const solvedIncorrectAnswersRef = collection(db, 'users', studentId, 'solved-incorrect-answers');

        const [
          myGameSetsSnapshot,
          playedSetsSnapshot,
          subjectStatsSnapshot,
          solvedIncorrectSnapshot,
        ] = await Promise.all([
          getDocs(myGameSetsQuery),
          getDocs(playedSetsQuery),
          getDocs(subjectStatsRef),
          getDocs(query(solvedIncorrectAnswersRef, orderBy('timestamp', 'desc'))),
        ]);

        const myGameSets = myGameSetsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GameSet))
          .sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        const playedSetIds = playedSetsSnapshot.docs.map(doc => (doc.data() as PlayedGameSet).gameSetId);
        let playedGameSets: GameSet[] = [];
        if (playedSetIds.length > 0) {
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
          playedGameSets = fetchedGameSets;
        }

        const subjectStats = transformStats(subjectStatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectStat)));
        const solvedReviewQuestions = solvedIncorrectSnapshot.docs.map(doc => doc.data() as SolvedIncorrectAnswer);

        const levelInfo = getLevelInfo(viewingStudent.xp);
        const nextLevelInfo = getNextLevelInfo(levelInfo.level);

        setStudentProfileData({
          myGameSets,
          playedGameSets,
          subjectStats,
          solvedReviewQuestions,
          levelInfo,
          nextLevelInfo,
        });

      } catch (error) {
        console.error("Error fetching student profile:", error);
        toast({ variant: 'destructive', title: '오류', description: '학생 정보를 불러오는 중 오류가 발생했습니다.' });
      } finally {
        setIsStudentProfileLoading(false);
      }
    };

    fetchStudentProfile();
  }, [viewingStudent, toast]);


  const totalClassPoints = useMemo(() => {
    return classmates.reduce((sum, cm) => sum + (cm.classPoints || 0), 0);
  }, [classmates]);

  const handleStudentSelectionChange = (studentId: string, isSelected: boolean) => {
    setSelectedStudents(prev => ({...prev, [studentId]: isSelected}));
  };

  const handleSelectAllStudents = (isSelected: boolean) => {
    const newSelection: Record<string, boolean> = {};
    if (isSelected) {
        classmates.forEach(cm => newSelection[cm.uid] = true);
    }
    setSelectedStudents(newSelection);
  }

  const handleBulkPointSend = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(id => selectedStudents[id]);
    if (selectedStudentIds.length === 0) {
        toast({variant: 'destructive', title: '오류', description: '포인트를 받을 학생을 선택해주세요.'});
        return;
    }
    if (bulkPointAmount <= 0) {
        toast({variant: 'destructive', title: '오류', description: '지급할 포인트는 0보다 커야 합니다.'});
        return;
    }

    setIsSubmitting(true);
    try {
        const batch = writeBatch(db);
        selectedStudentIds.forEach(studentId => {
            const userRef = doc(db, 'users', studentId);
            batch.update(userRef, { classPoints: increment(bulkPointAmount) });
            
            const logRef = doc(collection(db, 'users', studentId, 'pointLogs'));
            batch.set(logRef, {
                type: 'TEACHER_GRANT',
                amount: bulkPointAmount,
                timestamp: serverTimestamp(),
                description: bulkPointReason || '선생님 포인트 지급',
            } as Omit<PointLog, 'id'|'userId'>);
        });
        await batch.commit();
        toast({title: '성공', description: `${selectedStudentIds.length}명의 학생에게 ${bulkPointAmount}P를 지급했습니다.`});
        setShowBulkPointDialog(false);
        setBulkPointAmount(0);
        setBulkPointReason('');
        setSelectedStudents({});
    } catch (error) {
        console.error("Error sending bulk points: ", error);
        toast({variant: 'destructive', title: '오류', description: '포인트 지급 중 오류가 발생했습니다.'});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleBulkItemSend = async () => {
    const selectedStudentIds = Object.keys(selectedStudents).filter(id => selectedStudents[id]);
     if (selectedStudentIds.length === 0) {
        toast({variant: 'destructive', title: '오류', description: '상품을 받을 학생을 선택해주세요.'});
        return;
    }
    if (!selectedItemForBulkSend) {
        toast({variant: 'destructive', title: '오류', description: '지급할 상품을 선택해주세요.'});
        return;
    }
    if (bulkItemQuantity <= 0) {
        toast({variant: 'destructive', title: '오류', description: '수량은 1 이상이어야 합니다.'});
        return;
    }

    setIsSubmitting(true);
    try {
        const itemToSend = classStoreItems.find(item => item.id === selectedItemForBulkSend);
        if (!itemToSend) {
             throw new Error('Selected item not found');
        }

        const studentDocs = await Promise.all(selectedStudentIds.map(id => getDoc(doc(db, 'users', id))));
        
        const batch = writeBatch(db);

        studentDocs.forEach(studentDoc => {
            if (studentDoc.exists()) {
                const studentData = studentDoc.data() as User;
                const studentRef = studentDoc.ref;
                const itemInInventory = studentData.inventory?.[itemToSend.id];

                if (itemInInventory) {
                    batch.update(studentRef, {[`inventory.${itemToSend.id}.quantity`]: increment(bulkItemQuantity)});
                } else {
                    const newInventoryItem = {
                        name: itemToSend.name,
                        itemId: itemToSend.id,
                        quantity: bulkItemQuantity,
                        description: itemToSend.description,
                        sellerId: itemToSend.sellerId,
                        sellerNickname: itemToSend.sellerNickname,
                        price: itemToSend.price,
                        emoji: itemToSend.emoji,
                    };
                    batch.set(studentRef, { inventory: { [itemToSend.id]: newInventoryItem } }, { merge: true });
                }

                const logRef = doc(collection(db, 'users', studentDoc.id, 'pointLogs'));
                batch.set(logRef, {
                    type: 'ITEM_GIFT_RECEIVE',
                    amount: 0,
                    timestamp: serverTimestamp(),
                    description: `'${itemToSend.name}' ${bulkItemQuantity}개 지급 받음 (선생님으로부터)`,
                    relatedItemId: itemToSend.id,
                    relatedUserId: user?.uid,
                } as Omit<PointLog, 'id'|'userId'>);
            }
        });
        
        await batch.commit();
        toast({title: '성공', description: `${selectedStudentIds.length}명의 학생에게 '${itemToSend.name}' ${bulkItemQuantity}개를 지급했습니다.`});
        setShowBulkItemDialog(false);
        setSelectedItemForBulkSend('');
        setBulkItemQuantity(1);
        setSelectedStudents({});

    } catch (error) {
         console.error("Error sending bulk items: ", error);
        toast({variant: 'destructive', title: '오류', description: '상품 지급 중 오류가 발생했습니다.'});
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleOpenAnalytics = async (mode: 'students' | 'points' | 'items') => {
    if (classmates.length === 0 && mode !== 'items') {
      toast({
        variant: 'destructive',
        title: '데이터 부족',
        description: '분석할 학생 데이터가 없습니다.',
      });
      return;
    }
  
    setAnalyticsMode(mode);
    if (mode === 'students') return;
  
    setIsAnalyticsLoading(true);
  
    try {
      if (mode === 'points') {
        const studentUids = classmates.map((cm) => cm.uid);
        const allLogsPromises = studentUids.map((uid) => getDocs(collection(db, 'users', uid, 'pointLogs')));
        const allLogsSnapshots = await Promise.all(allLogsPromises);
        const allLogs: PointLog[] = allLogsSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data() as PointLog));
        
        const incomeByCategory: Record<string, number> = {};
        const expenseByCategory: Record<string, number> = {};

        allLogs.forEach(log => {
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

        setPointAnalysisData({ incomeChartData, expenseChartData, totalIncome, totalExpense });

      } else if (mode === 'items') {
        const studentUids = classmates.map((cm) => cm.uid);
        const allLogsPromises = studentUids.map((uid) => getDocs(query(collection(db, 'users', uid, 'pointLogs'), where('type', '==', 'ITEM_PURCHASE'))));
        const allLogsSnapshots = await Promise.all(allLogsPromises);
        const purchaseLogs: PointLog[] = allLogsSnapshots.flatMap((snapshot) => snapshot.docs.map((doc) => doc.data() as PointLog));

        const salesByItem: Record<string, { name: string; count: number; total: number }> = {};
        
        purchaseLogs.forEach((log) => {
          if (log.relatedItemId) {
            if (!salesByItem[log.relatedItemId]) {
              const itemInfo = classStoreItems.find(i => i.id === log.relatedItemId);
              salesByItem[log.relatedItemId] = {
                name: log.description?.replace(/'/g, '').replace(' 구매', '') || itemInfo?.name || '알 수 없는 상품',
                count: 0,
                total: 0,
              };
            }
            salesByItem[log.relatedItemId].count += 1;
            salesByItem[log.relatedItemId].total += Math.abs(log.amount);
          }
        });
        
        const sortedSales = Object.values(salesByItem).sort((a, b) => b.count - a.count);
        setItemSalesData(sortedSales);
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '분석 데이터를 불러오는 중 오류가 발생했습니다.',
      });
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const analyticsDialogTitle = useMemo(() => {
    switch(analyticsMode) {
        case 'students': return '학생별 포인트 현황';
        case 'points': return '학급 포인트 유통 현황';
        case 'items': return '상품 판매 순위';
        default: return '';
    }
  }, [analyticsMode]);
  
  const studentOverallAccuracy = useMemo(() => {
    if (!studentProfileData) return '0.0';
    let totalCorrect = 0;
    let totalIncorrect = 0;
    studentProfileData.subjectStats.forEach(stat => {
      totalCorrect += stat.totalCorrect || 0;
      totalIncorrect += stat.totalIncorrect || 0;
    });
    const total = totalCorrect + totalIncorrect;
    return total > 0 ? ((totalCorrect / total) * 100).toFixed(1) : '0.0';
  }, [studentProfileData]);

  const studentAvailableUnits = useMemo(() => {
    if (studentSelectedSubject === 'all' || !studentProfileData) {
      return [];
    }
    const subject = studentProfileData.subjectStats.find(s => s.id === studentSelectedSubject);
    const units = subject?.units ? Object.keys(subject.units) : [];
    return units;
  }, [studentSelectedSubject, studentProfileData]);

  useEffect(() => {
    setStudentSelectedUnit('all');
  }, [studentSelectedSubject]);

  const { studentFilteredCorrect, studentFilteredIncorrect, studentFilteredAccuracy } = useMemo(() => {
    if (!studentProfileData) return { studentFilteredCorrect: 0, studentFilteredIncorrect: 0, studentFilteredAccuracy: '0.0' };
    
    let correct = 0;
    let incorrect = 0;
    
    if (studentSelectedSubject === 'all') {
      studentProfileData.subjectStats.forEach(stat => {
        correct += stat.totalCorrect || 0;
        incorrect += stat.totalIncorrect || 0;
      });
    } else {
      const subject = studentProfileData.subjectStats.find(s => s.id === studentSelectedSubject);
      if (subject) {
        if (studentSelectedUnit === 'all') {
          correct = subject.totalCorrect || 0;
          incorrect = subject.totalIncorrect || 0;
        } else {
          if (subject.units && subject.units[studentSelectedUnit]) {
            correct = subject.units[studentSelectedUnit].totalCorrect || 0;
            incorrect = subject.units[studentSelectedUnit].totalIncorrect || 0;
          }
        }
      }
    }

    const total = correct + incorrect;
    const acc = total > 0 ? ((correct / total) * 100).toFixed(1) : '0.0';
    
    return { studentFilteredCorrect: correct, studentFilteredIncorrect: incorrect, studentFilteredAccuracy: acc };
  }, [studentProfileData, studentSelectedSubject, studentSelectedUnit]);

  const handleShowStudentIncorrectAnswers = () => {
    if (!studentProfileData) return;
    let filtered = studentProfileData.solvedReviewQuestions;

    if (studentSelectedSubject !== 'all') {
      filtered = filtered.filter(q => q.question.subject === studentSelectedSubject);
    }
    if (studentSelectedUnit !== 'all') {
      filtered = filtered.filter(q => q.question.unit === studentSelectedUnit);
    }
    
    setStudentIncorrectAnswersToShow(filtered);
    setShowStudentIncorrectAnswersDialog(true);
  };


  const allStudentsSelected = classmates.length > 0 && Object.keys(selectedStudents).length === classmates.length && Object.values(selectedStudents).every(v => v);

  const teacherPixelAvatar = useMemo(() => {
    if (!teacher?.pixelAvatar) return null;
    try {
      return JSON.parse(teacher.pixelAvatar);
    } catch (e) {
      console.error("Failed to parse teacher pixel avatar", e);
      return null;
    }
  }, [teacher]);
  
  const viewingStudentPixelData = useMemo(() => {
    if (!viewingStudent?.pixelAvatar) return null;
    try {
        return JSON.parse(viewingStudent.pixelAvatar);
    } catch(e) {
        console.error("Failed to parse viewing student pixel avatar", e);
        return null;
    }
  }, [viewingStudent]);

  if (loadingUser || isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-20 w-20 rounded-md" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || (!userData?.classId && userData?.role !== 'teacher')) {
    return (
      <div className="container mx-auto py-8">
        <Card className="text-center">
          <CardHeader>
            <CardTitle>학급에 참여해주세요</CardTitle>
            <CardDescription>
              아직 소속된 학급이 없습니다. 마이페이지에서 학급 코드를 입력하여
              학급에 참여하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/profile">마이페이지로 이동</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {userData?.role === 'teacher' && (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className='font-headline text-2xl'>교사 대시보드</CardTitle>
                    <CardDescription>학급의 전반적인 현황을 확인하고 관리합니다.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card onClick={() => handleOpenAnalytics('students')} className="cursor-pointer hover:bg-accent transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">학급 인원</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{classmates.length}명</div>
                        </CardContent>
                    </Card>
                    <Card onClick={() => handleOpenAnalytics('points')} className="cursor-pointer hover:bg-accent transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">유통된 총 포인트</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{totalClassPoints.toLocaleString()} P</div>
                        </CardContent>
                    </Card>
                    <Card onClick={() => handleOpenAnalytics('items')} className="cursor-pointer hover:bg-accent transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">판매중인 상품</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{classStoreItems.length}종</div>
                        </CardContent>
                    </Card>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className='font-headline'>교사 도구</CardTitle>
                    <CardDescription>학생들에게 포인트를 지급하거나 상품을 보낼 수 있습니다.</CardDescription>
                </CardHeader>
                <CardContent className='flex gap-4'>
                    <Button onClick={() => setShowBulkPointDialog(true)}>
                        <Send className="mr-2 h-4 w-4"/> 포인트 일괄 지급
                    </Button>
                    <Button variant="outline" onClick={() => setShowBulkItemDialog(true)}>
                        <Gift className="mr-2 h-4 w-4"/> 상품 일괄 지급
                    </Button>
                </CardContent>
            </Card>
        </>
      )}

      {teacher && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <PixelAvatar
                  pixels={teacherPixelAvatar}
                />
              </Avatar>
              <div>
                <CardTitle className="font-headline text-2xl flex items-center gap-2">
                  <Crown className="w-6 h-6 text-yellow-500" />
                  {teacher.displayName} 선생님
                </CardTitle>
                <CardDescription>{teacher.schoolName}</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            우리 학급 친구들
          </CardTitle>
          <CardDescription>
            총 {classmates.length}명의 친구들이 함께하고 있습니다. {userData?.role === 'teacher' && '학생을 클릭하여 상세 정보를 확인하세요.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {classmates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {classmates.map((member) => {
                let pixelAvatarData = null;
                if (member.pixelAvatar) {
                  try {
                    pixelAvatarData = JSON.parse(member.pixelAvatar);
                  } catch (e) {
                    console.error("Failed to parse member pixel avatar", e);
                  }
                }
                return (
                  <div
                    key={member.uid}
                    className={cn(
                        "flex flex-col items-center gap-2 text-center",
                        userData?.role === 'teacher' && "p-2 rounded-lg cursor-pointer hover:bg-accent transition-colors"
                    )}
                    onClick={() => userData?.role === 'teacher' && setViewingStudent(member)}
                  >
                    <Avatar className="h-20 w-20">
                      <PixelAvatar pixels={pixelAvatarData} />
                    </Avatar>
                    <p className="font-medium text-sm truncate w-full">
                      {member.displayName}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              아직 학급에 다른 친구들이 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center gap-2">
            <Store className="w-6 h-6 text-primary" />
            학급 매점
          </CardTitle>
          <CardDescription>
            학급 친구들이 판매하는 아이템을 구매하거나, 내 아이템을 판매할 수
            있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/class-store">매점으로 이동하기</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Teacher Dialogs */}
      <Dialog open={showBulkPointDialog} onOpenChange={setShowBulkPointDialog}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>포인트 일괄 지급</DialogTitle>
                <DialogDescription>선택한 학생들에게 포인트를 지급합니다.</DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-2'>
                <div className='space-y-2'>
                    <Label htmlFor="point-amount">지급할 포인트</Label>
                    <Input id="point-amount" type="number" value={bulkPointAmount} onChange={e => setBulkPointAmount(Number(e.target.value))} />
                </div>
                 <div className='space-y-2'>
                    <Label htmlFor="point-reason">지급 사유</Label>
                    <Textarea id="point-reason" placeholder='예: 1단원 단원평가 보상' value={bulkPointReason} onChange={e => setBulkPointReason(e.target.value)} />
                </div>
                <div className='space-y-2'>
                    <Label>지급 대상</Label>
                     <div className="flex items-center space-x-2 p-2">
                        <Checkbox id="select-all" checked={allStudentsSelected} onCheckedChange={(checked) => handleSelectAllStudents(!!checked)} />
                        <label htmlFor="select-all" className="text-sm font-medium leading-none">모두 선택</label>
                    </div>
                    <ScrollArea className='h-48 rounded-md border p-2'>
                        <div className='space-y-2'>
                            {classmates.map(cm => (
                                <div key={cm.uid} className="flex items-center space-x-2">
                                    <Checkbox id={`student-${cm.uid}`} checked={selectedStudents[cm.uid] || false} onCheckedChange={(checked) => handleStudentSelectionChange(cm.uid, !!checked)}/>
                                    <label htmlFor={`student-${cm.uid}`} className="text-sm font-medium leading-none">{cm.displayName}</label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setShowBulkPointDialog(false)}>취소</Button>
                <Button onClick={handleBulkPointSend} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    지급하기
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={showBulkItemDialog} onOpenChange={setShowBulkItemDialog}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>상품 일괄 지급</DialogTitle>
                <DialogDescription>선택한 학생들에게 상품을 지급합니다.</DialogDescription>
            </DialogHeader>
            <div className='space-y-4 py-2'>
                <div className='space-y-2'>
                    <Label htmlFor="item-select">지급할 상품</Label>
                     <Select value={selectedItemForBulkSend} onValueChange={setSelectedItemForBulkSend}>
                        <SelectTrigger id="item-select">
                            <SelectValue placeholder="상품 선택..." />
                        </SelectTrigger>
                        <SelectContent>
                            {classStoreItems.map(item => (
                                <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                 <div className='space-y-2'>
                    <Label htmlFor="item-quantity">지급할 수량</Label>
                    <Input id="item-quantity" type="number" min="1" value={bulkItemQuantity} onChange={e => setBulkItemQuantity(Number(e.target.value))} />
                </div>
                <div className='space-y-2'>
                    <Label>지급 대상</Label>
                     <div className="flex items-center space-x-2 p-2">
                        <Checkbox id="select-all-item" checked={allStudentsSelected} onCheckedChange={(checked) => handleSelectAllStudents(!!checked)} />
                        <label htmlFor="select-all-item" className="text-sm font-medium leading-none">모두 선택</label>
                    </div>
                    <ScrollArea className='h-48 rounded-md border p-2'>
                        <div className='space-y-2'>
                            {classmates.map(cm => (
                                <div key={cm.uid} className="flex items-center space-x-2">
                                    <Checkbox id={`student-item-${cm.uid}`} checked={selectedStudents[cm.uid] || false} onCheckedChange={(checked) => handleStudentSelectionChange(cm.uid, !!checked)}/>
                                    <label htmlFor={`student-item-${cm.uid}`} className="text-sm font-medium leading-none">{cm.displayName}</label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setShowBulkItemDialog(false)}>취소</Button>
                <Button onClick={handleBulkItemSend} disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    지급하기
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analytics Dialog */}
      <Dialog open={!!analyticsMode} onOpenChange={(isOpen) => !isOpen && setAnalyticsMode(null)}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    {analyticsMode === 'students' && <Users className="w-6 h-6 text-primary"/>}
                    {analyticsMode === 'points' && <Wallet className="w-6 h-6 text-primary"/>}
                    {analyticsMode === 'items' && <BarChart className="w-6 h-6 text-primary"/>}
                    {analyticsDialogTitle}
                </DialogTitle>
            </DialogHeader>
            <div className="min-h-[60vh]">
            {isAnalyticsLoading ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-primary"/>
                </div>
            ) : (
                <>
                {analyticsMode === 'students' && (
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">순위</TableHead>
                                    <TableHead>이름</TableHead>
                                    <TableHead className="text-right">보유 포인트</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classmates.map((student, index) => (
                                    <TableRow key={student.uid}>
                                        <TableCell className="font-bold text-center">{index + 1}</TableCell>
                                        <TableCell>{student.displayName}</TableCell>
                                        <TableCell className="text-right font-semibold">{(student.classPoints || 0).toLocaleString()} P</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                )}
                {analyticsMode === 'points' && pointAnalysisData && (
                    <Tabs defaultValue="overview">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="overview">수입 분석</TabsTrigger>
                            <TabsTrigger value="expense">지출 분석</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview">
                            <Card>
                                <CardHeader>
                                    <CardTitle>포인트 수입 항목</CardTitle>
                                    <CardDescription>총 수입: {pointAnalysisData.totalIncome.toLocaleString()} P</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ChartContainer config={{}} className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                                                <Pie data={pointAnalysisData.incomeChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {pointAnalysisData.incomeChartData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        <TabsContent value="expense">
                             <Card>
                                <CardHeader>
                                    <CardTitle>포인트 지출 항목</CardTitle>
                                    <CardDescription>총 지출: {pointAnalysisData.totalExpense.toLocaleString()} P</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <ChartContainer config={{}} className="h-64 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                                                <Pie data={pointAnalysisData.expenseChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                                    {pointAnalysisData.expenseChartData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                 <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </ChartContainer>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                )}
                 {analyticsMode === 'items' && (
                    <ScrollArea className="h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-16">순위</TableHead>
                                    <TableHead>상품명</TableHead>
                                    <TableHead className="text-right">판매량</TableHead>
                                    <TableHead className="text-right">총 판매액</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemSalesData.map((item, index) => (
                                    <TableRow key={item.name}>
                                        <TableCell className="font-bold text-center">{index + 1}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right">{item.count.toLocaleString()}개</TableCell>
                                        <TableCell className="text-right font-semibold">{item.total.toLocaleString()} P</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                         {itemSalesData.length === 0 && <p className="text-center text-muted-foreground p-8">아직 판매된 상품이 없습니다.</p>}
                    </ScrollArea>
                )}
                </>
            )}
            </div>
        </DialogContent>
      </Dialog>
      
      {/* Student Profile View Dialog */}
      <Dialog open={!!viewingStudent} onOpenChange={(isOpen) => {if (!isOpen) { setViewingStudent(null); setStudentProfileData(null); }}}>
        <DialogContent className="max-w-4xl min-h-[90vh]">
            {isStudentProfileLoading || !studentProfileData || !viewingStudent ? (
                <div className="flex justify-center items-center h-full min-h-[80vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary"/>
                </div>
            ) : (
                <>
                <DialogHeader>
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="relative h-24 w-24 flex items-center justify-center rounded-lg bg-secondary flex-shrink-0">
                            <PixelAvatar pixels={viewingStudentPixelData} className="w-full h-full" />
                        </div>
                        <div className="flex-grow">
                            <DialogTitle className="font-headline text-3xl flex items-center gap-2">
                                {viewingStudent.displayName}
                                <span className="text-lg text-muted-foreground font-normal">({viewingStudent.name})</span>
                            </DialogTitle>
                            <DialogDescription>{studentProfileData.levelInfo?.title}</DialogDescription>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                                <School className="w-4 h-4"/>
                                <span>{[viewingStudent.schoolName].filter(Boolean).join(' ')}</span>
                            </div>
                        </div>
                    </div>
                </DialogHeader>
                 <ScrollArea className="h-[calc(90vh-12rem)] -mx-6 px-6">
                    <div className="space-y-6 pt-4">
                        <Card>
                            <CardContent className="pt-6 space-y-6">
                                <div>
                                    <div className="flex justify-between items-end mb-1">
                                    <span className="text-sm font-medium">Lv. {studentProfileData.levelInfo?.level}</span>
                                    <span className="text-sm text-muted-foreground">
                                        {studentProfileData.nextLevelInfo ? `${viewingStudent.xp.toLocaleString()} / ${studentProfileData.nextLevelInfo.xpThreshold.toLocaleString()} XP` : '최고 레벨'}
                                    </span>
                                    </div>
                                    <Progress value={studentProfileData.nextLevelInfo ? ((viewingStudent.xp - (studentProfileData.levelInfo?.xpThreshold || 0)) / (studentProfileData.nextLevelInfo.xpThreshold - (studentProfileData.levelInfo?.xpThreshold || 0))) * 100 : 100} className="h-3" />
                                </div>
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                    <p className="text-2xl font-bold">{viewingStudent.xp.toLocaleString()}</p>
                                    <p className="text-sm text-muted-foreground">누적 포인트</p>
                                    </div>
                                    <div>
                                    <p className="flex items-center justify-center text-2xl font-bold">
                                        <Wallet className="w-5 h-5 mr-1 text-blue-500"/>
                                        {(viewingStudent.classPoints || 0).toLocaleString()}
                                    </p>
                                    <p className="text-sm text-muted-foreground">학급 포인트</p>
                                    </div>
                                    <div>
                                    <p className="text-2xl font-bold">{studentOverallAccuracy}%</p>
                                    <p className="text-sm text-muted-foreground">전체 정답률</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Tabs defaultValue="my-quizzes" className="w-full">
                            <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="my-quizzes">만든 퀴즈</TabsTrigger>
                            <TabsTrigger value="played-quizzes">푼 퀴즈</TabsTrigger>
                            <TabsTrigger value="achievement">성취도</TabsTrigger>
                            <TabsTrigger value="solved-review-notes">푼 오답</TabsTrigger>
                            </TabsList>
                            <TabsContent value="my-quizzes">
                                {studentProfileData.myGameSets.length === 0 ? <p className='text-center py-4 text-muted-foreground'>만든 퀴즈가 없습니다.</p> : studentProfileData.myGameSets.map(set => (
                                    <Card key={set.id} className='mb-2 cursor-pointer hover:bg-secondary' onClick={() => setStudentQuizPreview(set)}>
                                        <CardContent className='p-3'>
                                            <p className='font-semibold'>{set.title}</p>
                                            <p className='text-sm text-muted-foreground'>{set.questions.length} 문제</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </TabsContent>
                            <TabsContent value="played-quizzes">
                                {studentProfileData.playedGameSets.length === 0 ? <p className='text-center py-4 text-muted-foreground'>푼 퀴즈가 없습니다.</p> : studentProfileData.playedGameSets.map(set => <Card key={set.id} className='mb-2'><CardContent className='p-3'><p className='font-semibold'>{set.title}</p><p className='text-sm text-muted-foreground'>제작자: {set.creatorNickname}</p></CardContent></Card>)}
                            </TabsContent>
                            <TabsContent value="achievement">
                                {studentProfileData.subjectStats.length === 0 ? <p className='text-center py-4 text-muted-foreground'>학습 기록이 없습니다.</p> : (
                                    <div className="space-y-4 pt-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Select value={studentSelectedSubject} onValueChange={setStudentSelectedSubject}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="과목 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">전체 과목</SelectItem>
                                                    {studentProfileData.subjectStats.map(stat => (
                                                        <SelectItem key={stat.id} value={stat.id}>{stat.id}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Select value={studentSelectedUnit} onValueChange={setStudentSelectedUnit} disabled={studentSelectedSubject === 'all' || studentAvailableUnits.length === 0}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="단원 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">전체 단원</SelectItem>
                                                    {studentAvailableUnits.map(unit => (
                                                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-center p-4 bg-secondary rounded-lg">
                                            <div>
                                                <p className="text-2xl font-bold text-blue-600">{studentFilteredCorrect}</p>
                                                <p className="text-sm text-muted-foreground">정답</p>
                                            </div>
                                            <div className="cursor-pointer" onClick={handleShowStudentIncorrectAnswers}>
                                                <p className="text-2xl font-bold text-red-600">{studentFilteredIncorrect}</p>
                                                <p className="text-sm text-muted-foreground">오답</p>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-primary">{studentFilteredAccuracy}%</p>
                                                <p className="text-sm text-muted-foreground">정답률</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                            <TabsContent value="solved-review-notes">
                                {studentProfileData.solvedReviewQuestions.length === 0 ? <p className='text-center py-4 text-muted-foreground'>푼 오답 기록이 없습니다.</p> : studentProfileData.solvedReviewQuestions.map(item => (
                                    <Card key={item.id} className='mb-2'><CardContent className='p-3 space-y-1'><p className="font-semibold whitespace-pre-wrap">{item.question.question}</p><p className={cn("text-sm", item.wasReviewCorrect ? 'text-green-600' : 'text-red-600')}>복습 결과: {item.wasReviewCorrect ? '정답' : '오답'}</p></CardContent></Card>
                                ))}
                            </TabsContent>
                        </Tabs>
                        <Card>
                            <CardHeader><CardTitle className="font-headline flex items-center gap-2"><Trophy className="text-primary" /> 레벨 엠블럼</CardTitle></CardHeader>
                            <CardContent>
                               <TooltipProvider>
                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-4">
                                    {levelSystem.filter(level => viewingStudent.xp >= level.xpThreshold).map((level) => (
                                        <UITooltip key={level.level}>
                                            <UITooltipTrigger asChild>
                                                <div className="group relative aspect-square flex items-center justify-center p-1 rounded-full bg-secondary"><span className="text-4xl">{level.icon}</span></div>
                                            </UITooltipTrigger>
                                            <UITooltipContent><p className="font-semibold">Lv. {level.level}: {level.title}</p></UITooltipContent>
                                        </UITooltip>
                                    ))}
                                </div>
                               </TooltipProvider>
                            </CardContent>
                        </Card>
                    </div>
                 </ScrollArea>
                </>
            )}
        </DialogContent>
      </Dialog>
      
      {/* Student Quiz Preview Dialog */}
      {studentQuizPreview && (
        <Dialog open={!!studentQuizPreview} onOpenChange={() => setStudentQuizPreview(null)}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{studentQuizPreview.title}</DialogTitle>
                    <DialogDescription>{[studentQuizPreview.grade, studentQuizPreview.semester, studentQuizPreview.subject, studentQuizPreview.unit].filter(Boolean).join(' / ')}</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="questions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="questions"><BookOpen className="mr-2 h-4 w-4"/>문제 목록</TabsTrigger>
                    <TabsTrigger value="comments"><MessageSquare className="mr-2 h-4 w-4"/>댓글 ({studentQuizComments.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="questions">
                    <ScrollArea className="h-96 pr-4">
                        <div className="space-y-4">
                            {studentQuizPreview.questions.map((q, index) => (
                                <div key={index} className="p-4 rounded-md border bg-muted/50">
                                    <p className="font-semibold whitespace-pre-wrap">{index + 1}. {q.question}</p>
                                    {q.imageUrl && (
                                        <div className="mt-2 relative aspect-video">
                                            <Image src={q.imageUrl} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" />
                                        </div>
                                    )}
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
                          {studentQuizComments.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">아직 댓글이 없습니다.</div>
                          ) : (
                            studentQuizComments.map(comment => {
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
                    </div>
                  </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
      )}

       {/* Student incorrect answers dialog */}
       <Dialog open={showStudentIncorrectAnswersDialog} onOpenChange={setShowStudentIncorrectAnswersDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>오답 기록 확인</DialogTitle>
            <DialogDescription>
              {studentSelectedUnit !== 'all' ? `"${studentSelectedUnit}" 단원에서 ` : studentSelectedSubject !== 'all' ? `"${studentSelectedSubject}" 과목에서 ` : '전체 과목에서 '}
              틀린 문제 목록입니다.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <div className="space-y-4">
              {studentIncorrectAnswersToShow.length > 0 ? (
                studentIncorrectAnswersToShow.map(item => (
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
    </div>
  );
}

    

    



