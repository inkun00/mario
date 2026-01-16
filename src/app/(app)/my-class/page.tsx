

'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, Unsubscribe, runTransaction, updateDoc, deleteDoc, increment, orderBy, writeBatch, collectionGroup } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User, ClassStoreItem, ItemBuyer, ItemReport, PointLog, PointAcquisitionRule, Question } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Crown, Store, ShoppingCart, Repeat, Save, MinusCircle, Trash2, Gem, Package, Send, ArrowRightLeft, ArrowLeft, ArrowRight, Gift, Settings, AlertTriangle, ShieldCheck, Undo2, LineChart, Library, BarChartHorizontal, History } from 'lucide-react';
import { getLevelInfo, getNextLevelInfo, type LevelInfo } from '@/lib/level-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MotionDiv } from '@/components/motion-div';
import { PixelAvatar } from '@/components/pixel-avatar';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { v4 as uuidv4 } from 'uuid';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart, ResponsiveContainer, Cell, Pie, PieChart, Legend } from 'recharts';
import { Checkbox } from '@/components/ui/checkbox';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';


const sellItemSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요.').max(30, '상품명은 30자 이내로 입력해주세요.'),
  price: z.coerce.number().min(1, '가격은 1 이상이어야 합니다.'),
  description: z.string().min(1, '제품 설명을 입력해주세요.').max(200, '설명은 200자 이내로 입력해주세요.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
  emoji: z.string().optional(),
});

type SellItemFormValues = z.infer<typeof sellItemSchema>;

const emojiCategories = {
  '간식': ['🍕', '🍔', '🍟', '🌭', '🍿', '🥨', '🍪', '🍩', '🍦', '🍰', '🍫', '🍬', '🍭', '🍮', '🍯', '🍎', '🍇', '🍉', '🍓', '🍑', '🥝', '🥤', '🧃', '🥛', '☕'],
  '학교 및 학습': ['📚', '📖', '📝', '✏️', '🖍️', '🖌️', '✂️', '📏', '📐', '📌', '📎', '📓', '📒', '💼', '🎒', '🏫', '🔔', '⏰', '🗓️', '📋', '💯', '🏅', '🏆', '🥇', '🥈', '🥉', '🎓', '👨‍🏫', '👩‍🏫', '✨', '💡', '🔑'],
  '상업 및 서비스': ['💰', '🪙', '💵', '💳', '🧾', '🏷️', '📦', '🎁', '🎉', '💌', '💎', '👑', '🌟', '🚀', '🤝', '💪', '🙏', '😇', '😈', '🛡️', '⚔️'],
  '동물': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦'],
  '사물': ['📱', '💻', '🖥️', '📷', '📹', '📺', '🎸', '🎹', '🚗', '🚲', '✈️', '🎈'],
  '기타': ['❓', '❗️', '👻', '💀', '👽', '🤖', '👾', '🤡', '🤠', '🦄', '➡️', '↪️', '🔄', '🆓', '➕', '➖', '➗', '✖️'],
};

interface EmojiSelectorProps {
  value: string | undefined;
  onChange: (value: string) => void;
}

const EmojiSelector = React.memo(function EmojiSelector({ value, onChange }: EmojiSelectorProps) {
    return (
        <ScrollArea className="h-48">
             <div className="grid grid-cols-8 gap-1">
                {Object.entries(emojiCategories).map(([category, emojis]) => (
                    <React.Fragment key={category}>
                        <div className="col-span-8 text-sm font-medium text-muted-foreground pt-2">{category}</div>
                        {emojis.map((emoji) => (
                           <div
                              key={emoji}
                              onClick={() => onChange(emoji)}
                              className={cn(
                                "text-2xl p-2 rounded-md cursor-pointer transition-all flex items-center justify-center aspect-square",
                                value === emoji ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-accent"
                              )}
                            >
                              {emoji}
                            </div>
                        ))}
                    </React.Fragment>
                ))}
            </div>
        </ScrollArea>
    );
});
EmojiSelector.displayName = 'EmojiSelector';

interface AggregatedStat {
    total: number;
    correct: number;
    accuracy: number;
}

interface LearningAnalysisData {
    subjectStats: Record<string, AggregatedStat>;
    unitStats: Record<string, AggregatedStat>;
    lowAccuracyQuestions: (Question & { accuracy: number })[];
}

interface PointAnalysisData {
  totalHeldPoints: number;
  totalSpentPoints: number;
  topSoldItems: { name: string; count: number }[];
}


export default function MyClassPage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [classMembers, setClassMembers] = useState<User[]>([]);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [classStoreItems, setClassStoreItems] = useState<ClassStoreItem[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState(true);

  const [isSellItemDialogOpen, setIsSellItemDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{name: string, details: {itemId: string, quantity: number, description?: string, sellerId?: string, sellerNickname?: string, price?: number, emoji?: string}} | null>(null);
  const [isBuyItemDialogOpen, setIsBuyItemDialogOpen] = useState(false);
  const [selectedItemForDescription, setSelectedItemForDescription] = useState<ClassStoreItem | null>(null);
  
  const [evictCandidate, setEvictCandidate] = useState<User | null>(null);
  
  const [reportCandidate, setReportCandidate] = useState<ClassStoreItem | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const [reportedItemDetails, setReportedItemDetails] = useState<ClassStoreItem | null>(null);

  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [studentPointLogs, setStudentPointLogs] = useState<PointLog[]>([]);
  const [studentSellingItems, setStudentSellingItems] = useState<ClassStoreItem[]>([]);
  const [isStudentDetailsLoading, setIsStudentDetailsLoading] = useState(false);

  const [managementAction, setManagementAction] = useState<'sendPoints' | 'takePoints' | 'sendItem' | 'takeItem' | null>(null);
  const [managementAmount, setManagementAmount] = useState(1);
  const [managementItem, setManagementItem] = useState('');
  const [isManagementLoading, setIsManagementLoading] = useState(false);
  
  const [itemAction, setItemAction] = useState<'use' | 'send' | 'refund' | null>(null);
  const [actionQuantity, setActionQuantity] = useState(1);
  const [sendRecipient, setSendRecipient] = useState('');
  const [isItemActionLoading, setIsItemActionLoading] = useState(false);

  const [isRefundConfirmationOpen, setIsRefundConfirmationOpen] = useState(false);
  const [refundCandidate, setRefundCandidate] = useState<{name: string, details: {itemId: string, quantity: number, description?: string, sellerId?: string, sellerNickname?: string, price?: number}} | null>(null);
  
  const [selectedSellingItem, setSelectedSellingItem] = useState<ClassStoreItem | null>(null);
  const [itemBuyers, setItemBuyers] = useState<ItemBuyer[]>([]);
  const [isBuyersLoading, setIsBuyersLoading] = useState(false);
  const [editItemDescription, setEditItemDescription] = useState('');
  const [editItemQuantity, setEditItemQuantity] = useState(0);
  const [editItemPrice, setEditItemPrice] = useState(0);
  const [editItemEmoji, setEditItemEmoji] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const { toast } = useToast();

  const [learningAnalysisData, setLearningAnalysisData] = useState<LearningAnalysisData | null>(null);
  const [pointAnalysisData, setPointAnalysisData] = useState<PointAnalysisData | null>(null);
  const [allClassPointLogs, setAllClassPointLogs] = useState<(PointLog & { studentName: string })[]>([]);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);
  const [pointHistoryPage, setPointHistoryPage] = useState(1);

  const [isPointHistoryOpen, setIsPointHistoryOpen] = useState(false);
  const [pointLogs, setPointLogs] = useState<PointLog[]>([]);
  const [isPointHistoryLoading, setIsPointHistoryLoading] = useState(false);

  const [isSendPointsDialogOpen, setIsSendPointsDialogOpen] = useState(false);
  const [sendPointsAmount, setSendPointsAmount] = useState(0);
  const [sendPointsRecipient, setSendPointsRecipient] = useState('');
  const [isSendingPoints, setIsSendingPoints] = useState(false);

  const [isBulkSendDialogOpen, setIsBulkSendDialogOpen] = useState(false);
  const [bulkSendAmount, setBulkSendAmount] = useState(10);
  const [bulkSendReason, setBulkSendReason] = useState('');
  const [bulkSendRecipients, setBulkSendRecipients] = useState<string[]>([]);
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [chartView, setChartView] = useState<'income' | 'expense'>('income');

  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null);
  const [nextLevelInfo, setNextLevelInfo] = useState<LevelInfo | null>(null);


  const form = useForm<SellItemFormValues>({
    resolver: zodResolver(sellItemSchema),
    defaultValues: {
      name: '',
      price: 1,
      description: '',
      quantity: 1,
      emoji: '📝',
    }
  });

  const pointAnalysisDataForDialog = useMemo(() => {
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

 useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let unsubscribeStore: Unsubscribe | undefined;
    let unsubscribeMembers: Unsubscribe | undefined;
    let unsubscribeUser: Unsubscribe | undefined;

    const fetchClassData = async () => {
      setIsLoading(true);

      unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (userSnap) => {
        if (userSnap.exists()) {
            const currentUserData = { uid: userSnap.id, ...userSnap.data() } as User;
            setUserData(currentUserData);
            
            const currentLevel = getLevelInfo(currentUserData.xp);
            setLevelInfo(currentLevel);
            setNextLevelInfo(getNextLevelInfo(currentLevel.level));

            const targetClassId = currentUserData.role === 'teacher' ? user.uid : currentUserData.classId;

            if (targetClassId) {
                const membersQuery = query(collection(db, 'users'), where('classId', '==', targetClassId));
                
                if (currentUserData.role === 'teacher') {
                    setTeacher(currentUserData);
                    if (unsubscribeMembers) unsubscribeMembers();
                    unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
                        const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
                        // Also include the teacher in the list if they are managing their class
                        const allMembers = [currentUserData, ...members.filter(m => m.uid !== currentUserData.uid)];
                        const uniqueMembers = Array.from(new Map(allMembers.map(item => [item.uid, item])).values());
                        setClassMembers(uniqueMembers.sort((a, b) => (b.xp || 0) - (a.xp || 0)));
                    });
                } else {
                    const teacherRef = doc(db, 'users', targetClassId);
                    onSnapshot(teacherRef, (teacherSnapshot) => {
                        if (teacherSnapshot.exists()) {
                            const teacherData = { uid: teacherSnapshot.id, ...teacherSnapshot.data() } as User;
                            setTeacher(teacherData);
                            if (unsubscribeMembers) unsubscribeMembers();
                            unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
                                const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
                                const allMembers = [teacherData, ...members];
                                const uniqueMembers = Array.from(new Map(allMembers.map(item => [item.uid, item])).values());
                                setClassMembers(uniqueMembers.sort((a, b) => (b.xp || 0) - (a.xp || 0)));
                            });
                        }
                    });
                }
                
                // Fetch class store items
                setIsStoreLoading(true);
                const storeQuery = query(collection(db, 'class-store-items'), where('classId', '==', targetClassId));
                if (unsubscribeStore) unsubscribeStore();
                unsubscribeStore = onSnapshot(storeQuery, (snapshot) => {
                    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassStoreItem));
                    setClassStoreItems(items);
                    setIsStoreLoading(false);
                }, (error) => {
                    console.error("Error fetching store items:", error);
                    toast({ variant: "destructive", title: "오류", description: "학급 매장 상품을 불러오는 중 오류가 발생했습니다."});
                    setIsStoreLoading(false);
                });
            } else {
                setIsStoreLoading(false);
                setClassMembers([]);
                setTeacher(null);
            }
        }
        setIsLoading(false);
      });
    };

    fetchClassData();

    return () => {
        if (unsubscribeStore) unsubscribeStore();
        if (unsubscribeMembers) unsubscribeMembers();
        if (unsubscribeUser) unsubscribeUser();
    };
  }, [user, toast]);

    const handleTabChange = useCallback(async (tab: string) => {
        if (!classMembers || classMembers.length <= 1) return;

        if (tab === 'analysis' && !learningAnalysisData) {
            setIsAnalysisLoading(true);
            try {
                const studentIds = classMembers.filter(m => m.role !== 'teacher').map(m => m.uid);
                const allLogs: PointLog[] = [];
                
                for (const id of studentIds) {
                    const logsQuery = query(collection(db, `users/${id}/pointLogs`), where('type', '==', 'QUIZ_REWARD'));
                    const logSnapshot = await getDocs(logsQuery);
                    logSnapshot.forEach(doc => {
                        const logData = doc.data() as PointLog;
                        if (logData.relatedQuestion) {
                            allLogs.push(logData);
                        }
                    });
                }
                
                const subjectStats: Record<string, { total: number; correct: number }> = {};
                const unitStats: Record<string, { total: number; correct: number }> = {};
                const questionStats: Record<string, { total: number; correct: number; question: Question }> = {};

                allLogs.forEach(log => {
                    const question = log.relatedQuestion as Question;
                    if (!question || !question.subject) return;

                    const isCorrect = log.amount > 0;
                    
                    // Subject stats
                    if (!subjectStats[question.subject]) subjectStats[question.subject] = { total: 0, correct: 0 };
                    subjectStats[question.subject].total++;
                    if (isCorrect) subjectStats[question.subject].correct++;

                    // Unit stats (simple aggregation for now)
                    if (question.unit) {
                        const simpleUnit = question.unit.trim();
                        if (!unitStats[simpleUnit]) unitStats[simpleUnit] = { total: 0, correct: 0 };
                        unitStats[simpleUnit].total++;
                        if (isCorrect) unitStats[simpleUnit].correct++;
                    }

                    // Question stats
                    const questionKey = `${question.subject}-${question.unit}-${question.question}`;
                    if (!questionStats[questionKey]) questionStats[questionKey] = { total: 0, correct: 0, question: question };
                    questionStats[questionKey].total++;
                    if (isCorrect) questionStats[questionKey].correct++;
                });

                const toAggr = (stats: Record<string, { total: number; correct: number }>): Record<string, AggregatedStat> => {
                    return Object.entries(stats).reduce((acc, [key, val]) => {
                        acc[key] = { ...val, accuracy: val.total > 0 ? (val.correct / val.total) * 100 : 0 };
                        return acc;
                    }, {} as Record<string, AggregatedStat>);
                }

                const lowAccuracyQuestions = Object.values(questionStats)
                    .map(stat => ({ ...stat.question, accuracy: stat.total > 0 ? (stat.correct / stat.total) * 100 : 0 }))
                    .filter(q => q.accuracy < 100)
                    .sort((a, b) => a.accuracy - b.accuracy)
                    .slice(0, 10);

                setLearningAnalysisData({
                    subjectStats: toAggr(subjectStats),
                    unitStats: toAggr(unitStats),
                    lowAccuracyQuestions,
                });
            } catch (e) {
                console.error("Error analyzing learning data:", e);
                toast({ variant: 'destructive', title: '오류', description: '학습 데이터 분석 중 오류가 발생했습니다.'});
            } finally {
                setIsAnalysisLoading(false);
            }
        } else if (tab === 'point-analysis' && !pointAnalysisData) {
            setIsAnalysisLoading(true);
            try {
                const studentIds = classMembers.filter(m => m.role !== 'teacher').map(m => m.uid);
                const allLogs: (PointLog & { studentName: string })[] = [];
                
                for (const id of studentIds) {
                    const student = classMembers.find(m => m.uid === id);
                    if (!student) continue;

                    const logsQuery = query(collection(db, `users/${id}/pointLogs`));
                    const logSnapshot = await getDocs(logsQuery);
                    logSnapshot.forEach(doc => {
                        allLogs.push({ ...(doc.data() as PointLog), studentName: student.displayName });
                    });
                }
                
                setAllClassPointLogs(allLogs.sort((a, b) => (b.timestamp?.toDate()?.getTime() || 0) - (a.timestamp?.toDate()?.getTime() || 0)));
                
                const totalHeldPoints = classMembers.reduce((sum, member) => sum + (member.classPoints || 0), 0);
                const totalSpentPoints = allLogs
                    .filter(log => log.type === 'ITEM_PURCHASE')
                    .reduce((sum, log) => sum - log.amount, 0);

                const itemPurchaseCounts: Record<string, number> = {};
                allLogs.filter(log => log.type === 'ITEM_PURCHASE').forEach(log => {
                    const itemName = log.description.replace('\' 구매', '').replace('\'', '');
                    itemPurchaseCounts[itemName] = (itemPurchaseCounts[itemName] || 0) + 1;
                });

                const topSoldItems = Object.entries(itemPurchaseCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10);

                setPointAnalysisData({
                    totalHeldPoints,
                    totalSpentPoints,
                    topSoldItems,
                });

            } catch (e) {
                console.error("Error analyzing point data:", e);
                toast({ variant: 'destructive', title: '오류', description: '포인트 데이터 분석 중 오류가 발생했습니다.'});
            } finally {
                setIsAnalysisLoading(false);
            }
        }
    }, [learningAnalysisData, pointAnalysisData, classMembers, toast]);

  async function handleSellItem(data: SellItemFormValues) {
    if (!user || !userData) return;
    
    const classId = userData.role === 'teacher' ? user.uid : userData.classId;
    if (!classId) {
        toast({ variant: 'destructive', title: '오류', description: '소속된 학급이 없어 상품을 등록할 수 없습니다.' });
        return;
    }

    setIsSubmitting(true);
    try {
        await addDoc(collection(db, 'class-store-items'), {
            ...data,
            sellerId: user.uid,
            sellerName: userData.name || userData.displayName,
            sellerNickname: userData.displayName,
            classId: classId,
            createdAt: serverTimestamp(),
        });

        toast({ title: '성공', description: '상품을 성공적으로 등록했습니다.' });
        setIsSellItemDialogOpen(false);
        form.reset();
    } catch (error) {
        console.error("Error adding item to store: ", error);
        toast({ variant: 'destructive', title: '오류', description: '상품 등록 중 오류가 발생했습니다.' });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleBuyItem = async (item: ClassStoreItem) => {
    if (!user) return;
    setIsBuying(item.id);

    try {
        await runTransaction(db, async (transaction) => {
            const buyerRef = doc(db, 'users', user.uid);
            const sellerRef = doc(db, 'users', item.sellerId);
            const itemRef = doc(db, 'class-store-items', item.id);

            const [buyerDoc, sellerDoc, itemDoc] = await Promise.all([
                transaction.get(buyerRef),
                transaction.get(sellerRef),
                transaction.get(itemRef)
            ]);

            if (!buyerDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";
            if (!sellerDoc.exists()) throw "판매자 정보를 찾을 수 없습니다.";
            if (!itemDoc.exists()) throw "상품 정보를 찾을 수 없거나 이미 판매되었습니다.";

            const buyerData = buyerDoc.data() as User;
            const itemData = itemDoc.data() as ClassStoreItem;
            
            if ((buyerData.classPoints || 0) < itemData.price) {
                throw "학급 포인트가 부족합니다.";
            }
            
            if (itemData.quantity <= 0) {
                throw "상품의 재고가 없습니다.";
            }
            
            if (itemData.report) {
                throw "신고된 상품으로 구매할 수 없습니다.";
            }

            // 1. Update buyer's points and inventory
            const inventoryPath = `inventory.${item.name}`;
            const existingItem = buyerData.inventory?.[item.name];

            if (existingItem) {
                transaction.update(buyerRef, {
                    classPoints: increment(-itemData.price),
                    [`${inventoryPath}.quantity`]: increment(1),
                });
            } else {
                transaction.update(buyerRef, {
                    classPoints: increment(-itemData.price),
                    [inventoryPath]: {
                        itemId: item.id,
                        quantity: 1,
                        description: itemData.description,
                        sellerId: item.sellerId,
                        sellerNickname: item.sellerNickname,
                        price: item.price,
                        emoji: item.emoji,
                    }
                });
            }

            // 2. Log buyer's purchase
            const buyerLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
            transaction.set(buyerLogRef, {
                id: buyerLogRef.id,
                userId: user.uid,
                type: 'ITEM_PURCHASE',
                amount: -itemData.price,
                timestamp: serverTimestamp(),
                description: `'${item.name}' 구매`,
                relatedUserId: item.sellerId,
                relatedItemId: item.id
            } as PointLog);

            // 3. Update seller's points
            transaction.update(sellerRef, { classPoints: increment(itemData.price) });

            // 4. Log seller's sale
            const sellerLogRef = doc(collection(db, 'users', item.sellerId, 'pointLogs'));
            transaction.set(sellerLogRef, {
                id: sellerLogRef.id,
                userId: item.sellerId,
                type: 'ITEM_SALE',
                amount: itemData.price,
                timestamp: serverTimestamp(),
                description: `'${item.name}' 판매`,
                relatedUserId: user.uid,
                relatedItemId: item.id
            } as PointLog);

            // 5. Update item quantity
            transaction.update(itemRef, { quantity: increment(-1) });
        });
      
        toast({ title: '구매 완료!', description: `'${item.name}' 상품을 구매했습니다.` });

    } catch (error: any) {
        console.error("Purchase failed: ", error);
        toast({ variant: "destructive", title: "구매 실패", description: typeof error === 'string' ? error : "구매 중 오류가 발생했습니다."});
    } finally {
        setIsBuying(null);
    }
};
  
  const handleEvictStudent = async () => {
    if (!evictCandidate || !isTeacher) return;
    
    try {
      const studentRef = doc(db, 'users', evictCandidate.uid);
      await updateDoc(studentRef, { classId: null });
      toast({ title: '성공', description: `${evictCandidate.name || evictCandidate.displayName} 학생을 학급에서 내보냈습니다.` });
      setEvictCandidate(null);
    } catch(error) {
      toast({ variant: 'destructive', title: '오류', description: '학생을 내보내는 중 오류가 발생했습니다.' });
      console.error('Error evicting student:', error);
    }
  };

  const handleStudentClick = async (student: User) => {
    if (!isTeacher) return;

    setSelectedStudent(student);
    setIsStudentDetailsLoading(true);

    try {
        const sellingItemsQuery = query(collection(db, 'class-store-items'), where('sellerId', '==', student.uid));
        const pointLogsQuery = query(collection(db, 'users', student.uid, 'pointLogs'), orderBy('timestamp', 'asc'));

        const [sellingItemsSnapshot, pointLogsSnapshot] = await Promise.all([
            getDocs(sellingItemsQuery),
            getDocs(pointLogsQuery)
        ]);

        const sellingItems = sellingItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassStoreItem));
        const pointLogs = pointLogsSnapshot.docs.map(doc => doc.data() as PointLog);
        
        setStudentSellingItems(sellingItems);
        setStudentPointLogs(pointLogs);

    } catch (error) {
        console.error("Error fetching student details:", error);
        toast({ variant: 'destructive', title: '오류', description: '학생의 상세 정보를 불러오는 데 실패했습니다.' });
    } finally {
        setIsStudentDetailsLoading(false);
    }
  };

  const handleManagementAction = async () => {
    if (!selectedStudent || !managementAction || !isTeacher || !user) return;

    setIsManagementLoading(true);
    const studentRef = doc(db, 'users', selectedStudent.uid);

    try {
        if (managementAction === 'sendPoints' || managementAction === 'takePoints') {
            if (managementAmount <= 0) throw "포인트는 0보다 커야 합니다.";
            const amount = managementAction === 'sendPoints' ? managementAmount : -managementAmount;
            
            const batch = writeBatch(db);
            
            batch.update(studentRef, { classPoints: increment(amount) });
            
            const logDocRef = doc(collection(db, 'users', selectedStudent.uid, 'pointLogs'));
            batch.set(logDocRef, {
                id: logDocRef.id,
                userId: selectedStudent.uid,
                type: amount > 0 ? 'TEACHER_GRANT' : 'TEACHER_DEDUCT',
                amount: amount,
                timestamp: serverTimestamp(),
                description: `선생님 ${amount > 0 ? '지급' : '회수'}`
            } as PointLog);

            await batch.commit();

            toast({ title: '성공', description: `${selectedStudent.displayName} 학생의 포인트를 ${Math.abs(amount)} 만큼 ${amount > 0 ? '보냈습니다' : '가져왔습니다'}.`});
        
        } else if (managementAction === 'sendItem' || managementAction === 'takeItem') {
            if (!managementItem) throw "상품을 선택해주세요.";
            const amount = managementAction === 'sendItem' ? managementAmount : -managementAmount;

            await runTransaction(db, async (transaction) => {
                const studentDoc = await transaction.get(studentRef);
                if (!studentDoc.exists()) throw "학생 정보를 찾을 수 없습니다.";
                
                const studentData = studentDoc.data() as User;
                const inventory = { ...(studentData.inventory || {}) };
                const studentItemQuantity = inventory[managementItem]?.quantity || 0;
                
                const storeItem = classStoreItems.find(item => item.name === managementItem && item.sellerId === user.uid);
                
                if (managementAction === 'sendItem') {
                    if (!storeItem || storeItem.quantity < amount) {
                        throw "보낼 상품의 재고가 부족합니다.";
                    }
                    // Decrease store quantity
                    const storeItemRef = doc(db, 'class-store-items', storeItem.id);
                    transaction.update(storeItemRef, { quantity: increment(-amount) });
                }
                
                if (managementAction === 'takeItem') {
                    if (studentItemQuantity < Math.abs(amount)) {
                        throw "가져올 상품의 수량이 부족합니다.";
                    }
                    if (storeItem) {
                        // Increase store quantity
                        const storeItemRef = doc(db, 'class-store-items', storeItem.id);
                        transaction.update(storeItemRef, { quantity: increment(Math.abs(amount)) });
                    }
                }
                
                const newQuantity = studentItemQuantity + amount;
                if (newQuantity > 0) {
                    inventory[managementItem] = {
                        ...(inventory[managementItem] || storeItem),
                        itemId: inventory[managementItem]?.itemId || storeItem?.id || 'teacher_sent',
                        quantity: newQuantity,
                        description: inventory[managementItem]?.description || storeItem?.description || '선생님이 보낸 상품'
                    };
                } else {
                    delete inventory[managementItem];
                }
                transaction.update(studentRef, { inventory: inventory });
            });

            toast({ title: '성공', description: `${selectedStudent.displayName} 학생에게 '${managementItem}' 상품을 ${Math.abs(amount)}개 ${amount > 0 ? '보냈습니다' : '가져왔습니다'}.`});
        }
        
        // Optimistic update of student data in the dialog
        const updatedStudent = { ...selectedStudent };
        if (managementAction === 'sendPoints' || managementAction === 'takePoints') {
            const amount = managementAction === 'sendPoints' ? managementAmount : -managementAmount;
            updatedStudent.classPoints = (updatedStudent.classPoints || 0) + amount;
        } else {
            // This part is complex to update optimistically without re-fetching, so we'll rely on the snapshot listener
        }
        setSelectedStudent(updatedStudent);
        
        setManagementAction(null);
        setManagementAmount(1);
        setManagementItem('');

    } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: typeof error === 'string' ? error : error.message || "작업 처리 중 오류가 발생했습니다."});
    } finally {
        setIsManagementLoading(false);
    }
  };

    const handleUpdateSellingItem = async () => {
        if (!selectedSellingItem) return;

        try {
            const itemRef = doc(db, 'class-store-items', selectedSellingItem.id);
            await updateDoc(itemRef, {
                description: editItemDescription,
                quantity: editItemQuantity,
                price: editItemPrice,
                emoji: editItemEmoji,
            });

            toast({ title: '성공', description: '상품 정보가 업데이트되었습니다.'});
            setSelectedSellingItem(null);
        } catch (e) {
            console.error("Error updating selling item:", e);
            toast({variant: 'destructive', title: '오류', description: '상품 정보 업데이트 중 오류가 발생'});
        }
    };

    const handleDeleteSellingItem = async () => {
        if (!selectedSellingItem) return;
        try {
            await deleteDoc(doc(db, 'class-store-items', selectedSellingItem.id));
            toast({ title: '삭제 완료', description: `'${selectedSellingItem.name}' 상품을 매장에서 삭제했습니다.` });
            setSelectedSellingItem(null);
        } catch (e) {
            console.error("Error deleting selling item:", e);
            toast({variant: 'destructive', title: '오류', description: '상품 삭제 중 오류 발생'});
        }
    };
    
    const handleDeleteItem = async (item: ClassStoreItem) => {
        try {
            await deleteDoc(doc(db, 'class-store-items', item.id));
            toast({ title: '상품 삭제', description: `'${item.name}' 상품이 매점에서 삭제되었습니다.` });
        } catch (error) {
            console.error("Error deleting item:", error);
            toast({ variant: "destructive", title: "오류", description: "상품 삭제 중 오류가 발생했습니다." });
        }
    };


    const handleReportItem = async () => {
        if (!reportCandidate || !reportReason.trim() || !user || !userData) return;
        setIsReporting(true);
        
        try {
            const reportData: ItemReport = {
                reporterId: user.uid,
                reporterName: userData.displayName,
                reason: reportReason,
                reportedAt: serverTimestamp(),
            };

            const itemRef = doc(db, 'class-store-items', reportCandidate.id);
            await updateDoc(itemRef, { report: reportData });
            
            toast({ title: '신고 완료', description: '상품이 신고되었습니다. 선생님이 검토할 예정입니다.' });
            setReportCandidate(null);
            setReportReason('');

        } catch (error) {
            console.error("Error reporting item:", error);
            toast({ variant: "destructive", title: "신고 실패", description: "상품 신고 중 오류가 발생했습니다."});
        } finally {
            setIsReporting(false);
        }
    };
    
    const handleClearReport = async () => {
        if (!reportedItemDetails || !isTeacher) return;
        try {
            const itemRef = doc(db, 'class-store-items', reportedItemDetails.id);
            await updateDoc(itemRef, { report: null });
            toast({ title: '신고 해제 완료', description: `'${reportedItemDetails.name}' 상품의 신고가 해제되었습니다.` });
            setReportedItemDetails(null);
        } catch (error) {
            console.error("Error clearing report:", error);
            toast({ variant: 'destructive', title: '오류', description: '신고 해제 중 오류가 발생했습니다.'});
        }
    }
    
    const handleItemClick = (item: ClassStoreItem) => {
        if (isTeacher && item.report) {
            setReportedItemDetails(item);
        } else {
            setSelectedItemForDescription(item);
        }
    }
    
    const handleItemAction = async () => {
      if (!selectedItem || !itemAction || !user) return;
      
      setIsItemActionLoading(true);

      try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', user.uid);
            
            // READ operations first
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) throw "내 정보를 찾을 수 없습니다.";
            
            const item = userDoc.data()?.inventory?.[selectedItem.name];
            if (!item || item.quantity < actionQuantity) throw "상품 수량이 부족합니다.";
            
            let sellerRef, sellerDoc, recipientRef, recipientDoc, storeItemRef, storeItemDoc;
            if (itemAction === 'refund') {
                if (!item.sellerId) throw "환불 정보를 찾을 수 없습니다.";
                sellerRef = doc(db, 'users', item.sellerId);
                sellerDoc = await transaction.get(sellerRef);
                storeItemRef = doc(db, 'class-store-items', item.itemId);
                storeItemDoc = await transaction.get(storeItemRef);
            }
            if (itemAction === 'send') {
                 if (!sendRecipient) throw "받는 사람을 선택해주세요.";
                 recipientRef = doc(db, 'users', sendRecipient);
                 recipientDoc = await transaction.get(recipientRef);
                 if (!recipientDoc.exists()) throw "받는 사람의 정보를 찾을 수 없습니다.";
            }

            // WRITE operations after all reads
            const currentUserData = userDoc.data() as User;
            const inventory = { ...currentUserData.inventory };

            switch (itemAction) {
              case 'use':
                  if (item.quantity > actionQuantity) {
                      inventory[selectedItem.name].quantity -= actionQuantity;
                  } else {
                      delete inventory[selectedItem.name];
                  }
                  transaction.update(userRef, { inventory: inventory });
                  break;
              
              case 'send':
                  if (!recipientRef) throw "Recipient ref not defined."; // Should not happen
                  
                  // Update sender's inventory
                  if (item.quantity > actionQuantity) {
                      inventory[selectedItem.name].quantity -= actionQuantity;
                  } else {
                      delete inventory[selectedItem.name];
                  }
                  transaction.update(userRef, { inventory: inventory });
                  
                  const senderLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
                  transaction.set(senderLogRef, { id: senderLogRef.id, userId: user.uid, type: 'SEND_POINTS', amount: 0, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 보내기`, relatedUserId: sendRecipient, relatedItemId: item.itemId } as PointLog);

                  // Update recipient's inventory
                  const recipientData = recipientDoc?.data() as User;
                  const recipientInventory = { ...recipientData.inventory };
                  const recipientItem = recipientInventory[selectedItem.name];
                  const newQuantity = (recipientItem?.quantity || 0) + actionQuantity;
                  recipientInventory[selectedItem.name] = {
                      ...item,
                      quantity: newQuantity,
                  };
                  transaction.update(recipientRef, { inventory: recipientInventory });

                  const recipientLogRef = doc(collection(db, 'users', sendRecipient, 'pointLogs'));
                  transaction.set(recipientLogRef, { id: recipientLogRef.id, userId: sendRecipient, type: 'RECEIVE_POINTS', amount: 0, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 받기`, relatedUserId: user.uid, relatedItemId: item.itemId } as PointLog);
                  break;

              case 'refund':
                   if (!item.price || !item.sellerId || !sellerRef || !storeItemRef) throw "환불 정보를 찾을 수 없습니다.";
                   const refundAmount = item.price * actionQuantity;
                   
                   // Update user's inventory and points
                   if (item.quantity > actionQuantity) {
                        inventory[selectedItem.name].quantity -= actionQuantity;
                   } else {
                       delete inventory[selectedItem.name];
                   }
                   transaction.update(userRef, { 
                     inventory: inventory,
                     classPoints: increment(refundAmount),
                   });
                   const buyerRefundLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
                   transaction.set(buyerRefundLogRef, { id: buyerRefundLogRef.id, userId: user.uid, type: 'ITEM_REFUND_BUYER', amount: refundAmount, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 환불`, relatedUserId: item.sellerId, relatedItemId: item.itemId } as PointLog);


                   // Update seller's points
                   transaction.update(sellerRef, { classPoints: increment(-refundAmount) });
                   const sellerRefundLogRef = doc(collection(db, 'users', item.sellerId, 'pointLogs'));
                   transaction.set(sellerRefundLogRef, { id: sellerRefundLogRef.id, userId: item.sellerId, type: 'ITEM_REFUND_SELLER', amount: -refundAmount, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 환불 처리`, relatedUserId: user.uid, relatedItemId: item.itemId } as PointLog);

                   // Update store item quantity
                   if (storeItemDoc?.exists()) {
                     transaction.update(storeItemRef, { quantity: increment(actionQuantity) });
                   } else {
                     // If item was deleted, re-create it
                     transaction.set(storeItemRef, {
                        ...item,
                        quantity: actionQuantity,
                        sellerNickname: item.sellerNickname, 
                     });
                   }
                  break;
            }
        });

        toast({ title: '성공', description: `'${selectedItem.name}' ${actionQuantity}개를 처리했습니다.` });
        setSelectedItem(null);
        setItemAction(null);

      } catch (error: any) {
        toast({ variant: 'destructive', title: '오류', description: typeof error === 'string' ? error : error.message });
      } finally {
        setIsItemActionLoading(false);
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
    const recipientName = classMembers.find(m => m.uid === sendPointsRecipient)?.displayName || '친구';
    
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user.uid);
        const recipientRef = doc(db, 'users', sendPointsRecipient);

        const [senderDoc, recipientDoc] = await Promise.all([
          transaction.get(senderRef),
          transaction.get(recipientRef)
        ]);

        if (!senderDoc.exists() || !recipientDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";

        const senderData = senderDoc.data() as User;
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

  const handleBulkSendPoints = async () => {
    if (!user || !isTeacher || bulkSendRecipients.length === 0 || bulkSendAmount <= 0 || !bulkSendReason.trim()) {
        toast({ variant: 'destructive', title: '오류', description: '받는 사람, 보낼 금액, 지급 사유를 모두 확인해주세요.'});
        return;
    }

    setIsBulkSending(true);
    try {
        const batch = writeBatch(db);
        
        bulkSendRecipients.forEach(recipientId => {
            const studentRef = doc(db, 'users', recipientId);
            batch.update(studentRef, { classPoints: increment(bulkSendAmount) });

            const logDocRef = doc(collection(db, 'users', recipientId, 'pointLogs'));
            batch.set(logDocRef, {
                id: logDocRef.id,
                userId: recipientId,
                type: 'TEACHER_GRANT',
                amount: bulkSendAmount,
                timestamp: serverTimestamp(),
                description: bulkSendReason,
                relatedUserId: user.uid,
            } as PointLog);
        });

        await batch.commit();

        toast({ title: '일괄 지급 완료', description: `${bulkSendRecipients.length}명의 학생에게 ${bulkSendAmount.toLocaleString()} 포인트를 성공적으로 보냈습니다.` });
        setIsBulkSendDialogOpen(false);
        setBulkSendAmount(10);
        setBulkSendReason('');
        setBulkSendRecipients([]);

    } catch (error) {
        console.error("Error bulk sending points:", error);
        toast({ variant: 'destructive', title: '일괄 지급 실패', description: '포인트 일괄 지급 중 오류가 발생했습니다.'});
    } finally {
        setIsBulkSending(false);
    }
  };

  const handleManageSellingItem = useCallback(async (item: ClassStoreItem) => {
    setSelectedSellingItem(item);
    setEditItemDescription(item.description);
    setEditItemQuantity(item.quantity);
    setEditItemPrice(item.price);
    setEditItemEmoji(item.emoji || '');
    setItemBuyers([]);
    setIsBuyersLoading(true);

    try {
        const q = query(
          collectionGroup(db, "pointLogs"),
          where("relatedItemId", "==", item.id),
          where("type", "==", "ITEM_PURCHASE")
        );

        const snapshot = await getDocs(q);
        
        const buyersData: Record<string, ItemBuyer> = {};

        snapshot.forEach(doc => {
            const log = doc.data() as PointLog;
            const buyerId = log.userId;
            if (!buyersData[buyerId]) {
                buyersData[buyerId] = {
                    uid: buyerId,
                    name: '정보 없음', 
                    nickname: '정보 없음',
                    quantity: 0
                };
            }
            buyersData[buyerId].quantity += 1;
        });

        const buyerDetailsPromises = Object.keys(buyersData).map(uid => getDoc(doc(db, 'users', uid)));
        const buyerSnapshots = await Promise.all(buyerDetailsPromises);
        
        buyerSnapshots.forEach(buyerSnap => {
            if (buyerSnap.exists()) {
                const buyerData = buyerSnap.data() as User;
                if (buyersData[buyerData.uid]) {
                    buyersData[buyerData.uid].name = buyerData.name || '이름 없음';
                    buyersData[buyerData.uid].nickname = buyerData.displayName || '닉네임 없음';
                }
            }
        });
        
        setItemBuyers(Object.values(buyersData));

    } catch (error) {
        console.error("Error fetching item buyers:", error);
        toast({ variant: 'destructive', title: '오류', description: '구매자 목록을 불러오는 중 오류가 발생했습니다.'});
    } finally {
        setIsBuyersLoading(false);
    }
}, [toast]);

  const ITEMS_PER_PAGE = 10;
  const indexOfLastLog = pointHistoryPage * ITEMS_PER_PAGE;
  const indexOfFirstLog = indexOfLastLog - ITEMS_PER_PAGE;
  const currentLogs = allClassPointLogs.slice(indexOfFirstLog, indexOfLastLog);
  const totalLogPages = Math.ceil(allClassPointLogs.length / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalLogPages) {
      setPointHistoryPage(page);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!userData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>오류</CardTitle>
        </CardHeader>
        <CardContent>
          <p>사용자 정보를 불러올 수 없습니다. 다시 로그인해주세요.</p>
        </CardContent>
      </Card>
    );
  }

  const isTeacher = userData.role === 'teacher';
  const hasClass = (isTeacher && userData.classCode) || (!isTeacher && userData.classId);
  const sellingItems = classStoreItems.filter(item => item.sellerId === user?.uid);
  const canSendPoints = classMembers.filter(m => m.uid !== user?.uid).length > 0;

  const studentPointHistoryChartData = studentPointLogs.reduce((acc, log) => {
    if (!log.timestamp) return acc;
    const date = (log.timestamp as any)?.toDate().toISOString().split('T')[0];
    const lastEntry = acc[acc.length - 1];
    const newTotal = (lastEntry ? lastEntry.totalPoints : 0) + log.amount;

    if (lastEntry && lastEntry.date === date) {
      lastEntry.totalPoints = newTotal;
    } else {
      acc.push({ date, totalPoints: newTotal });
    }
    return acc;
  }, [] as { date: string; totalPoints: number }[]);

  const pointHistoryChartData = pointLogs.reduce((acc, log) => {
    if (!log.timestamp) return acc;
    const date = (log.timestamp as any)?.toDate().toISOString().split('T')[0];
    const lastEntry = acc[acc.length - 1];
    const newTotal = (lastEntry ? lastEntry.totalPoints : 0) + log.amount;

    if (lastEntry && lastEntry.date === date) {
      lastEntry.totalPoints = newTotal;
    } else {
      acc.push({ date, totalPoints: newTotal });
    }
    return acc;
  }, [] as { date: string; totalPoints: number }[]);

  const chartConfig = {
    totalPoints: {
      label: "누적 포인트",
      color: "hsl(var(--primary))",
    },
  };
  
    const analysisChartData = learningAnalysisData
        ? Object.entries(learningAnalysisData.subjectStats)
            .map(([subject, data]) => ({ name: subject, 정답률: data.accuracy }))
            .sort((a,b) => b.정답률 - a.정답률)
        : [];
    const analysisUnitChartData = learningAnalysisData
        ? Object.entries(learningAnalysisData.unitStats)
            .map(([unit, data]) => ({ name: unit, 정답률: data.accuracy }))
            .sort((a,b) => b.정답률 - a.정답률)
        : [];
    
    const analysisChartConfig = {
        정답률: {
            label: "정답률 (%)",
            color: "hsl(var(--primary))",
        },
    };
    
    const pointAnalysisChartData = pointAnalysisData?.topSoldItems || [];
    const pointAnalysisChartConfig = {
        count: {
            label: "판매 수량",
            color: "hsl(var(--chart-1))",
        }
    };

    const COLORS = [
        "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
        "hsl(var(--chart-4))", "hsl(var(--chart-5))"
    ];
    
    const chartConfigForDialog: Record<string, { label: string; color?: string }> = { value: { label: "포인트" } };
    pointAnalysisDataForDialog.incomeChartData.forEach((item, index) => {
        chartConfigForDialog[item.name as keyof typeof chartConfigForDialog] = { label: item.name, color: COLORS[index % COLORS.length] };
    });
    pointAnalysisDataForDialog.expenseChartData.forEach((item, index) => {
        chartConfigForDialog[item.name as keyof typeof chartConfigForDialog] = { label: item.name, color: COLORS[index % COLORS.length] };
    });


  const xpForNextLevel = nextLevelInfo ? nextLevelInfo.xpThreshold - (levelInfo?.xpThreshold || 0) : 0;
  const currentXpProgress = userData ? userData.xp - (levelInfo?.xpThreshold || 0) : 0;
  const progressPercentage = xpForNextLevel > 0 ? (currentXpProgress / xpForNextLevel) * 100 : 100;

  const schoolInfo = [userData?.schoolName, userData?.grade && `${userData.grade}학년`, userData?.class && `${userData.class}반`].filter(Boolean).join(' ');

  if (isLoading) {
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
      
      {/* Rest of the component remains the same... */}
    </div>
    </TooltipProvider>
  );
}

    