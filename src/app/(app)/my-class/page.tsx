

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, Unsubscribe, runTransaction, updateDoc, deleteDoc, increment, orderBy, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User, ClassStoreItem, ItemBuyer, ItemReport, PointLog, PointAcquisitionRule, Question } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Crown, Store, ShoppingCart, Repeat, Save, MinusCircle, Trash2, Gem, Package, Send, ArrowRightLeft, ArrowLeft, ArrowRight, Gift, Settings, AlertTriangle, ShieldCheck, Undo2, LineChart, Library } from 'lucide-react';
import { getLevelInfo } from '@/lib/level-system';
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
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Bar, BarChart } from 'recharts';


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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const { toast } = useToast();

  const [learningAnalysisData, setLearningAnalysisData] = useState<LearningAnalysisData | null>(null);
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false);

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

      const userRef = doc(db, 'users', user.uid);
      unsubscribeUser = onSnapshot(userRef, (userSnap) => {
        if (userSnap.exists()) {
            const currentUserData = { uid: userSnap.id, ...userSnap.data() } as User;
            setUserData(currentUserData);
            
            const targetClassId = currentUserData.role === 'teacher' ? user.uid : currentUserData.classId;

            if (targetClassId) {
                const membersQuery = query(collection(db, 'users'), where('classId', '==', targetClassId));
                
                if (currentUserData.role === 'teacher') {
                    setTeacher(currentUserData);
                    if (unsubscribeMembers) unsubscribeMembers();
                    unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
                        const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
                        // Also include the teacher in the list
                        setClassMembers([currentUserData, ...members].sort((a, b) => b.xp - a.xp));
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
                                setClassMembers([teacherData, ...members].sort((a, b) => b.xp - a.xp));
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
        if (tab === 'analysis' && !learningAnalysisData && classMembers.length > 1) {
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
        }
    }, [learningAnalysisData, classMembers, toast]);

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
        const sellerData = sellerDoc.data() as User;
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

        // 1. Decrement buyer's points and log it
        transaction.update(buyerRef, { classPoints: increment(-itemData.price) });
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

        // 2. Add item to buyer's inventory
        const newInventory = { ...buyerData.inventory };
        const currentQuantity = newInventory[itemData.name]?.quantity || 0;
        newInventory[itemData.name] = { 
            itemId: item.id,
            quantity: currentQuantity + 1,
            description: itemData.description,
            sellerId: item.sellerId,
            sellerNickname: item.sellerNickname,
            price: item.price,
            emoji: item.emoji,
        };
        transaction.update(buyerRef, { inventory: newInventory });

        // 3. Increment seller's points and log it
        transaction.update(sellerRef, { classPoints: increment(itemData.price) });
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

        // 4. Decrement item quantity or delete
        if (itemData.quantity > 1) {
          transaction.update(itemRef, { quantity: itemData.quantity - 1 });
        } else {
          transaction.delete(itemRef);
        }
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
            });

            toast({ title: '성공', description: '상품 정보가 업데이트되었습니다.'});
            setSelectedSellingItem(null);
        } catch (e) {
            console.error("Error updating selling item:", e);
            toast({variant: 'destructive', title: '오류', description: '상품 정보 업데이트 중 오류 발생'});
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
      const userRef = doc(db, 'users', user.uid);

      try {
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists()) throw "내 정보를 찾을 수 없습니다.";
          const currentUserData = userDoc.data() as User;
          const inventory = { ...currentUserData.inventory };
          const item = inventory[selectedItem.name];

          if (!item || item.quantity < actionQuantity) throw "상품 수량이 부족합니다.";
          

          switch (itemAction) {
              case 'use':
                  if (item.quantity > actionQuantity) {
                      item.quantity -= actionQuantity;
                  } else {
                      delete inventory[selectedItem.name];
                  }
                  transaction.update(userRef, { inventory: inventory });
                  break;
              
              case 'send':
                  if (!sendRecipient) throw "받는 사람을 선택해주세요.";
                  const recipientRef = doc(db, 'users', sendRecipient);
                  const recipientDoc = await transaction.get(recipientRef);
                  if (!recipientDoc.exists()) throw "받는 사람의 정보를 찾을 수 없습니다.";

                  // Remove from sender's inventory
                  if (item.quantity > actionQuantity) {
                      item.quantity -= actionQuantity;
                  } else {
                      delete inventory[selectedItem.name];
                  }
                  transaction.update(userRef, { inventory: inventory });
                  
                  const senderLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
                  transaction.set(senderLogRef, { id: senderLogRef.id, userId: user.uid, type: 'SEND_POINTS', amount: 0, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 보내기`, relatedUserId: sendRecipient, relatedItemId: item.itemId } as PointLog);

                  // Add to recipient's inventory
                  const recipientData = recipientDoc.data() as User;
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
                   if (!item.price || !item.sellerId) throw "환불 정보를 찾을 수 없습니다.";
                   const refundAmount = item.price * actionQuantity;
                   
                   // Remove item from user and give points back
                   if (item.quantity > actionQuantity) {
                        item.quantity -= actionQuantity;
                   } else {
                       delete inventory[selectedItem.name];
                   }
                   transaction.update(userRef, { 
                     inventory: inventory,
                     classPoints: increment(refundAmount),
                   });
                   const buyerRefundLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
                   transaction.set(buyerRefundLogRef, { id: buyerRefundLogRef.id, userId: user.uid, type: 'ITEM_REFUND_BUYER', amount: refundAmount, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 환불`, relatedUserId: item.sellerId, relatedItemId: item.itemId } as PointLog);


                   // Take points from seller
                   const sellerRef = doc(db, 'users', item.sellerId);
                   transaction.update(sellerRef, { classPoints: increment(-refundAmount) });
                   const sellerRefundLogRef = doc(collection(db, 'users', item.sellerId, 'pointLogs'));
                   transaction.set(sellerRefundLogRef, { id: sellerRefundLogRef.id, userId: item.sellerId, type: 'ITEM_REFUND_SELLER', amount: -refundAmount, timestamp: serverTimestamp(), description: `'${selectedItem.name}' ${actionQuantity}개 환불 처리`, relatedUserId: user.uid, relatedItemId: item.itemId } as PointLog);

                   // Add item back to store
                   const storeItemRef = doc(db, 'class-store-items', item.itemId);
                   const storeItemDoc = await transaction.get(storeItemRef);
                   if (storeItemDoc.exists()) {
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

  const chartData = studentPointLogs.reduce((acc, log) => {
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


  return (
    <>
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl flex items-center gap-2">
              <Users />
              나의 학급
          </CardTitle>
          {teacher && (
              <CardDescription>
                  {teacher.name || teacher.displayName} 선생님의 학급
              </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {!hasClass ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground">
                {isTeacher ? '아직 학급 코드를 설정하지 않았습니다. 마이페이지에서 학급 코드를 설정해주세요.' : '아직 소속된 학급이 없습니다. 마이페이지에서 학급 코드를 입력하여 참여하세요.'}
              </p>
            </div>
          ) : (
            <Tabs defaultValue="ranking" className="w-full" onValueChange={handleTabChange}>
              <TabsList className={cn("grid w-full", isTeacher ? "grid-cols-3" : "grid-cols-2")}>
                {isTeacher && <TabsTrigger value="analysis">학습 분석</TabsTrigger>}
                <TabsTrigger value="ranking">우리 학급 랭킹</TabsTrigger>
                <TabsTrigger value="store">학급 매장</TabsTrigger>
              </TabsList>
              {isTeacher && (
                <TabsContent value="analysis" className="mt-4">
                     {isAnalysisLoading ? (
                         <div className="flex justify-center items-center h-64">
                             <Loader2 className="w-8 h-8 animate-spin text-primary" />
                             <p className="ml-2">학습 데이터를 분석하는 중...</p>
                         </div>
                     ) : !learningAnalysisData || Object.keys(learningAnalysisData.subjectStats).length === 0 ? (
                         <div className="text-center py-12 border-2 border-dashed rounded-lg">
                             <p className="text-muted-foreground">분석할 학습 데이터가 부족합니다.</p>
                         </div>
                     ) : (
                         <div className="space-y-8">
                             <Card>
                                 <CardHeader>
                                     <CardTitle>과목별 정답률</CardTitle>
                                 </CardHeader>
                                 <CardContent>
                                     <ChartContainer config={analysisChartConfig} className="h-64 w-full">
                                         <BarChart data={analysisChartData} accessibilityLayer>
                                             <CartesianGrid vertical={false} />
                                             <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                             <YAxis domain={[0, 100]} unit="%" />
                                             <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                             <Bar dataKey="정답률" fill="var(--color-정답률)" radius={4} />
                                         </BarChart>
                                     </ChartContainer>
                                 </CardContent>
                             </Card>
                              <Card>
                                 <CardHeader>
                                     <CardTitle>단원별 정답률 (상위 10개)</CardTitle>
                                 </CardHeader>
                                 <CardContent>
                                     <ChartContainer config={analysisChartConfig} className="h-64 w-full">
                                         <BarChart data={analysisUnitChartData.slice(0,10)} layout="vertical" accessibilityLayer>
                                             <CartesianGrid horizontal={false} />
                                             <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} fontSize={12} />
                                             <XAxis type="number" domain={[0, 100]} unit="%" />
                                             <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                                             <Bar dataKey="정답률" fill="var(--color-정답률)" radius={4} />
                                         </BarChart>
                                     </ChartContainer>
                                 </CardContent>
                             </Card>
                             <Card>
                                <CardHeader>
                                    <CardTitle>정답률이 낮은 문제 TOP 10</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>문제</TableHead>
                                                <TableHead className="text-right">정답률</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {learningAnalysisData.lowAccuracyQuestions.map((q, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="max-w-sm truncate">{q.question}</TableCell>
                                                    <TableCell className="text-right font-semibold text-destructive">{q.accuracy.toFixed(1)}%</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                             </Card>
                         </div>
                     )}
                </TabsContent>
              )}
              <TabsContent value="ranking" className="mt-4">
                {classMembers.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">아직 학급에 참여한 학생이 없습니다.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] text-center">순위</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>학교</TableHead>
                        <TableHead className="text-center">레벨</TableHead>
                        <TableHead className="text-right">경험치 (XP)</TableHead>
                         {isTeacher && <TableHead className="text-right w-[100px]">작업</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classMembers.map((member, index) => {
                        const rank = index + 1;
                        const levelInfo = getLevelInfo(member.xp);
                        let pixelAvatarData = null;
                        if (member.pixelAvatar) {
                            try {
                                pixelAvatarData = JSON.parse(member.pixelAvatar);
                            } catch(e) { console.error("Error parsing pixel avatar", e); }
                        }
                        const displayName = member.name || member.displayName;

                        return (
                          <TableRow 
                            key={member.uid} 
                            className={cn(
                                member.uid === user?.uid ? 'bg-primary/10' : '',
                                isTeacher ? 'cursor-pointer hover:bg-muted/50' : ''
                            )}
                            onClick={() => isTeacher && handleStudentClick(member)}
                          >
                            <TableCell className="font-bold text-center text-lg">
                              {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="flex items-center justify-center bg-muted h-10 w-10">
                                    {pixelAvatarData ? (
                                        <PixelAvatar pixels={pixelAvatarData} />
                                    ) : (
                                        <AvatarFallback>{displayName.substring(0,2)}</AvatarFallback>
                                    )}
                                </Avatar>
                                <span className="font-medium">{displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{member.schoolName}</TableCell>
                            <TableCell className="text-center font-medium">Lv. {levelInfo.level}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{member.xp.toLocaleString()}</TableCell>
                            {isTeacher && (
                                <TableCell className="text-right">
                                    {member.uid !== user?.uid && (
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            onClick={(e) => { e.stopPropagation(); setEvictCandidate(member);}}
                                        >
                                            <MinusCircle className="mr-2 h-4 w-4"/> 퇴장
                                        </Button>
                                    )}
                                </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
              <TabsContent value="store" className="mt-4">
                  <Card>
                      <CardHeader>
                          <div className="flex justify-between items-center">
                              <div>
                                  <CardTitle className="flex items-center gap-2"><Store className="text-primary"/>학급 매점</CardTitle>
                                  <CardDescription>학급 포인트를 사용하여 다양한 아이템을 구매하거나 판매할 수 있습니다.</CardDescription>
                              </div>
                              <div className="text-sm font-bold text-blue-500">내 포인트: {(userData.classPoints || 0).toLocaleString()}</div>
                          </div>
                      </CardHeader>
                      <CardContent className="flex flex-col sm:flex-row gap-4">
                        <Dialog open={isBuyItemDialogOpen} onOpenChange={setIsBuyItemDialogOpen}>
                              <DialogTrigger asChild>
                                  <Button className="w-full">
                                      <ShoppingCart className="mr-2 h-4 w-4"/> 물건 사기
                                  </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl">
                                  <DialogHeader>
                                      <DialogTitle>학급 매점</DialogTitle>
                                      <DialogDescription>판매 중인 물품 목록입니다. 상품명을 클릭하여 설명을 볼 수 있습니다.</DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="h-[34rem]">
                                    {isStoreLoading ? (
                                      <div className="flex justify-center items-center h-full">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                      </div>
                                    ) : classStoreItems.length === 0 ? (
                                      <div className="text-center py-12">
                                        <p className="text-muted-foreground">아직 판매 중인 상품이 없습니다.</p>
                                      </div>
                                    ) : (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead>상품명</TableHead>
                                            <TableHead>판매자</TableHead>
                                            <TableHead className="text-center">수량</TableHead>
                                            <TableHead className="text-right">가격 (포인트)</TableHead>
                                            <TableHead className="w-[120px] text-center">동작</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {classStoreItems.map((item) => (
                                            <TableRow key={item.id} className={cn(item.report && 'bg-destructive/10')}>
                                              <TableCell 
                                                className="font-medium cursor-pointer hover:underline"
                                                onClick={() => handleItemClick(item)}
                                              >
                                                <div className="flex items-center gap-2">
                                                  {item.emoji && <span className="text-lg">{item.emoji}</span>}
                                                  {item.report && <AlertTriangle className="w-4 h-4 text-destructive" />}
                                                  {item.name}
                                                </div>
                                              </TableCell>
                                              <TableCell>{item.sellerNickname}</TableCell>
                                              <TableCell className="text-center">{item.quantity}</TableCell>
                                              <TableCell className="text-right font-bold text-primary">{item.price.toLocaleString()}</TableCell>
                                              <TableCell className="text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                  {item.sellerId !== user?.uid && !isTeacher && (
                                                    <Button 
                                                      size="sm" 
                                                      disabled={!!isBuying || !!item.report}
                                                      onClick={() => handleBuyItem(item)}
                                                      title={item.report ? '신고된 상품은 구매할 수 없습니다.' : ''}
                                                    >
                                                      {isBuying === item.id ? <Loader2 className="w-4 h-4 animate-spin"/> : '구매'}
                                                    </Button>
                                                  )}
                                                  {item.sellerId !== user?.uid && !isTeacher && !item.report && (
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                                      onClick={() => setReportCandidate(item)}
                                                    >
                                                      <AlertTriangle className="w-4 h-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    )}
                                  </ScrollArea>
                              </DialogContent>
                          </Dialog>
                          <Dialog open={isSellItemDialogOpen} onOpenChange={setIsSellItemDialogOpen}>
                              <DialogTrigger asChild>
                                  <Button className="w-full" variant="secondary">
                                      <Repeat className="mr-2 h-4 w-4"/> 물건 팔기
                                  </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg">
                                  <DialogHeader>
                                      <DialogTitle>판매할 물건 등록하기</DialogTitle>
                                      <DialogDescription>판매할 상품의 정보를 입력해주세요.</DialogDescription>
                                  </DialogHeader>
                                  <Form {...form}>
                                      <form onSubmit={form.handleSubmit(handleSellItem)} className="space-y-4">
                                          <FormField
                                              control={form.control}
                                              name="name"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel>상품명</FormLabel>
                                                      <FormControl><Input {...field} placeholder="예: 숙제 1회 면제권" /></FormControl>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                        <FormField
                                          control={form.control}
                                          name="emoji"
                                          render={({ field }) => (
                                            <FormItem className="space-y-3">
                                              <FormLabel>아이콘</FormLabel>
                                              <FormControl>
                                                <EmojiSelector value={field.value} onChange={field.onChange} />
                                              </FormControl>
                                              <FormMessage />
                                            </FormItem>
                                          )}
                                        />
                                          <FormField
                                              control={form.control}
                                              name="price"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel>가격 (학급 포인트)</FormLabel>
                                                      <FormControl><Input type="number" {...field} /></FormControl>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                          <FormField
                                              control={form.control}
                                              name="description"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel>제품 설명</FormLabel>
                                                      <FormControl><Textarea {...field} placeholder="상품에 대해 자세히 설명해주세요." /></FormControl>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                          <FormField
                                              control={form.control}
                                              name="quantity"
                                              render={({ field }) => (
                                                  <FormItem>
                                                      <FormLabel>수량</FormLabel>
                                                      <FormControl><Input type="number" {...field} /></FormControl>
                                                      <FormMessage />
                                                  </FormItem>
                                              )}
                                          />
                                          <DialogFooter>
                                              <Button type="submit" disabled={isSubmitting}>
                                                  {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                                  저장하기
                                              </Button>
                                          </DialogFooter>
                                      </form>
                                  </Form>
                              </DialogContent>
                          </Dialog>
                      </CardContent>
                  </Card>
                  <div className="mt-6 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline flex items-center gap-2"><Package className="text-primary"/>보유 상품</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {userData.inventory && Object.keys(userData.inventory).length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(userData.inventory).map(([itemName, itemDetails]) => (
                                        <Card 
                                          key={itemName} 
                                          className="p-4 text-center cursor-pointer hover:shadow-md hover:border-primary transition flex flex-col items-center gap-2"
                                          onClick={() => setSelectedItem({ name: itemName, details: itemDetails })}
                                        >
                                            <div className="text-4xl">{itemDetails.emoji || '📦'}</div>
                                            <CardTitle className="text-base">{itemName}</CardTitle>
                                            <CardDescription className="mt-1">수량: {itemDetails.quantity}</CardDescription>
                                            {itemDetails.sellerNickname && (
                                                <CardDescription className="text-xs mt-auto pt-2">판매자: {itemDetails.sellerNickname}</CardDescription>
                                            )}
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                                    <p className="text-muted-foreground">아직 보유한 상품이 없습니다.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                          <CardTitle className="font-headline flex items-center gap-2">
                            <Send className="text-primary"/>판매 중인 상품
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {sellingItems.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {sellingItems.map((item) => (
                                <Card key={item.id} className="flex flex-col">
                                  <CardHeader className="items-center">
                                      <div className="text-5xl mb-2">{item.emoji || '📦'}</div>
                                      <CardTitle className="text-lg text-center">{item.name}</CardTitle>
                                      <CardDescription className="text-sm text-primary font-bold">
                                        {item.price.toLocaleString()} 포인트
                                      </CardDescription>
                                  </CardHeader>
                                  <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                      {item.description}
                                    </p>
                                    <p className="text-sm mt-2">
                                      남은 수량: <span className="font-bold">{item.quantity}</span>
                                    </p>
                                  </CardContent>
                                  <CardFooter>
                                    <Button variant="outline" className="w-full" onClick={() => {
                                      setSelectedSellingItem(item);
                                      setEditItemDescription(item.description);
                                      setEditItemQuantity(item.quantity);
                                      setEditItemPrice(item.price);
                                    }}>
                                      <Settings className="mr-2 h-4 w-4" />
                                      관리
                                    </Button>
                                  </CardFooter>
                                </Card>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 border-2 border-dashed rounded-lg">
                              <p className="text-muted-foreground">현재 판매 중인 상품이 없습니다.</p>
                            </div>
                          )}
                        </CardContent>
                    </Card>
                  </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </MotionDiv>
    
    {/* Item Action Dialog */}
    <Dialog open={!!selectedItem} onOpenChange={(isOpen) => !isOpen && setSelectedItem(null)}>
        <DialogContent>
            <DialogHeader className="items-center text-center">
                <div className="text-6xl mb-2">{selectedItem?.details.emoji || '📦'}</div>
                <DialogTitle className="text-2xl">{selectedItem?.name}</DialogTitle>
                <DialogDescription>{selectedItem?.details.description}</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                <div className="flex justify-center gap-2">
                    <Button variant={itemAction === 'use' ? 'default' : 'outline'} onClick={() => setItemAction('use')}>사용</Button>
                    <Button variant={itemAction === 'send' ? 'default' : 'outline'} onClick={() => setItemAction('send')}>보내기</Button>
                    {selectedItem?.details.price && <Button variant={itemAction === 'refund' ? 'default' : 'outline'} onClick={() => setItemAction('refund')}>환불</Button>}
                </div>
                
                {itemAction && (
                    <div className="p-4 border rounded-md space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="quantity">수량</Label>
                            <Input 
                                id="quantity"
                                type="number" 
                                min="1" 
                                max={selectedItem?.details.quantity} 
                                value={actionQuantity} 
                                onChange={(e) => setActionQuantity(Number(e.target.value))}
                            />
                        </div>
                        {itemAction === 'send' && (
                            <div className="space-y-2">
                                <Label>받는 사람</Label>
                                <Combobox
                                    options={classMembers.filter(m => m.uid !== user?.uid).map(m => ({ value: m.uid, label: m.displayName }))}
                                    value={sendRecipient}
                                    onValueChange={setSendRecipient}
                                    placeholder="보낼 친구 선택..."
                                />
                            </div>
                        )}
                        {itemAction === 'refund' && (
                           <p className="text-sm text-center text-primary">
                                환불 시 {((selectedItem?.details.price || 0) * actionQuantity).toLocaleString()} 학급 포인트가 반환됩니다.
                            </p>
                        )}
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setSelectedItem(null)}>취소</Button>
                <Button onClick={handleItemAction} disabled={!itemAction || isItemActionLoading}>
                    {isItemActionLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : '확인'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


    {/* Item Description Dialog */}
    <Dialog open={!!selectedItemForDescription} onOpenChange={(isOpen) => !isOpen && setSelectedItemForDescription(null)}>
        <DialogContent className="text-center">
            <DialogHeader className="items-center">
                <div className="text-6xl mb-2">{selectedItemForDescription?.emoji || '📦'}</div>
                <DialogTitle className="text-2xl">{selectedItemForDescription?.name}</DialogTitle>
                <DialogDescription>
                    {selectedItemForDescription?.description || "설명이 없는 상품입니다."}
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button onClick={() => setSelectedItemForDescription(null)} className="w-full">닫기</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* Evict Student Confirmation Dialog */}
    <AlertDialog open={!!evictCandidate} onOpenChange={(isOpen) => !isOpen && setEvictCandidate(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말 학생을 내보내시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    {evictCandidate?.name || evictCandidate?.displayName} 학생을 학급에서 내보냅니다. 이 학생은 더 이상 학급 랭킹과 매장에 접근할 수 없게 됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleEvictStudent} className="bg-destructive hover:bg-destructive/90">내보내기</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    {/* Report Item Dialog */}
    <Dialog open={!!reportCandidate} onOpenChange={(isOpen) => {if(!isOpen) { setReportCandidate(null); setReportReason('')}}}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>상품 신고하기: {reportCandidate?.name}</DialogTitle>
                <DialogDescription>
                    부적절하거나 규칙에 어긋나는 상품이라고 생각되면 신고해주세요. 신고 내용은 선생님만 확인할 수 있습니다.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Textarea 
                    placeholder="신고 사유를 구체적으로 입력해주세요."
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                />
            </div>
            <DialogFooter>
                 <Button variant="ghost" onClick={() => {setReportCandidate(null); setReportReason('')}}>취소</Button>
                <Button onClick={handleReportItem} disabled={isReporting || !reportReason.trim()}>
                    {isReporting ? <Loader2 className="w-4 h-4 animate-spin"/> : '제출하기'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* Reported Item Details Dialog (for teacher) */}
    <Dialog open={!!reportedItemDetails} onOpenChange={(isOpen) => !isOpen && setReportedItemDetails(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>신고된 상품 정보</DialogTitle>
                <DialogDescription>
                    '{reportedItemDetails?.name}' 상품에 대한 신고 내역입니다.
                </DialogDescription>
            </DialogHeader>
            {reportedItemDetails?.report && (
                 <div className="py-4 space-y-4">
                    <div className="space-y-1">
                        <h4 className="font-semibold">신고자</h4>
                        <p className="text-sm text-muted-foreground">{reportedItemDetails.report.reporterName}</p>
                    </div>
                     <div className="space-y-1">
                        <h4 className="font-semibold">신고 사유</h4>
                        <p className="text-sm p-3 bg-muted rounded-md whitespace-pre-wrap">{reportedItemDetails.report.reason}</p>
                    </div>
                     <div className="space-y-1">
                        <h4 className="font-semibold">신고 시간</h4>
                        <p className="text-sm text-muted-foreground">
                            {new Date((reportedItemDetails.report.reportedAt as any).toDate()).toLocaleString()}
                        </p>
                    </div>
                 </div>
            )}
            <DialogFooter>
                <Button variant="ghost" onClick={() => setReportedItemDetails(null)}>닫기</Button>
                <Button onClick={handleClearReport}>
                    <ShieldCheck className="mr-2 h-4 w-4"/> 신고 해제하기
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>


    {/* Student Details Dialog */}
    <Dialog open={!!selectedStudent} onOpenChange={(isOpen) => !isOpen && setSelectedStudent(null)}>
      <DialogContent className="max-w-4xl min-h-[80vh]">
        {selectedStudent && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  <PixelAvatar pixels={selectedStudent.pixelAvatar ? JSON.parse(selectedStudent.pixelAvatar) : null} />
                </Avatar>
                <div>
                  <DialogTitle className="font-headline text-2xl">{selectedStudent.name || selectedStudent.displayName}</DialogTitle>
                  <DialogDescription>학생의 상세 정보 및 포인트 활동 내역입니다.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">개요</TabsTrigger>
                <TabsTrigger value="inventory">보유 상품</TabsTrigger>
                <TabsTrigger value="selling">판매 중인 상품</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="mt-4">
                <div className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2"><LineChart className="w-5 h-5 text-primary"/>포인트 활동</CardTitle>
                        </CardHeader>
                        <CardContent>
                             {isStudentDetailsLoading ? (
                                <div className="flex justify-center items-center h-56"><Loader2 className="w-8 h-8 animate-spin"/></div>
                            ) : chartData.length > 0 ? (
                                <>
                                    <ChartContainer config={chartConfig} className="h-56 w-full">
                                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <CartesianGrid vertical={false} />
                                            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                            <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                                            <ChartTooltip content={<ChartTooltipContent />} />
                                            <Area dataKey="totalPoints" type="monotone" fill="var(--color-totalPoints)" fillOpacity={0.4} stroke="var(--color-totalPoints)" />
                                        </AreaChart>
                                    </ChartContainer>
                                    <ScrollArea className="h-56 mt-4">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>시간</TableHead>
                                                    <TableHead>내용</TableHead>
                                                    <TableHead className="text-right">포인트</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {[...studentPointLogs].reverse().map(log => (
                                                    <TableRow key={log.id}>
                                                        <TableCell className="text-xs">{new Date((log.timestamp as any)?.toDate()).toLocaleString()}</TableCell>
                                                        <TableCell>{log.description}</TableCell>
                                                        <TableCell className={cn("text-right font-semibold", log.amount > 0 ? "text-green-600" : "text-red-600")}>
                                                            {log.amount > 0 ? '+' : ''}{log.amount.toLocaleString()}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </ScrollArea>
                                </>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">포인트 활동 내역이 없습니다.</div>
                            )}
                        </CardContent>
                    </Card>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Button variant="outline" size="sm" onClick={() => setManagementAction('sendPoints')}><ArrowRight className="w-4 h-4 mr-1"/>포인트 보내기</Button>
                        <Button variant="outline" size="sm" onClick={() => setManagementAction('takePoints')}><ArrowLeft className="w-4 h-4 mr-1"/>포인트 가져오기</Button>
                        <Button variant="outline" size="sm" onClick={() => setManagementAction('sendItem')}><Gift className="w-4 h-4 mr-1"/>상품 보내기</Button>
                        <Button variant="outline" size="sm" onClick={() => setManagementAction('takeItem')}><Package className="w-4 h-4 mr-1"/>상품 가져오기</Button>
                    </div>
                </div>
              </TabsContent>
              <TabsContent value="inventory" className="mt-4">
                <ScrollArea className="h-[60vh]">
                    {selectedStudent.inventory && Object.keys(selectedStudent.inventory).length > 0 ? (
                        <div className="space-y-2 pr-4">
                            {Object.entries(selectedStudent.inventory).map(([itemName, itemDetails]) => (
                                <Card key={itemName} className="p-3 flex items-center gap-4">
                                    <div className="text-3xl">{itemDetails.emoji || '📦'}</div>
                                    <div>
                                        <h4 className="font-semibold">{itemName}</h4>
                                        <p className="text-sm text-muted-foreground">보유 수량: {itemDetails.quantity}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            보유 중인 상품이 없습니다.
                        </div>
                    )}
                </ScrollArea>
              </TabsContent>
              <TabsContent value="selling" className="mt-4">
                <ScrollArea className="h-[60vh]">
                    {isStudentDetailsLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : studentSellingItems.length > 0 ? (
                        <div className="space-y-2 pr-4">
                             {studentSellingItems.map((item) => (
                                <Card key={item.id} className="p-3 flex items-center gap-4">
                                  <div className="text-3xl">{item.emoji || '📦'}</div>
                                    <div>
                                        <h4 className="font-semibold">{item.name}</h4>
                                        <p className="text-sm text-muted-foreground">가격: {item.price} / 남은 수량: {item.quantity}</p>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-10 text-muted-foreground">
                            판매 중인 상품이 없습니다.
                        </div>
                    )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Student Management Dialog */}
    <Dialog open={!!managementAction} onOpenChange={(isOpen) => !isOpen && setManagementAction(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {managementAction === 'sendPoints' && '포인트 보내기'}
                    {managementAction === 'takePoints' && '포인트 가져오기'}
                    {managementAction === 'sendItem' && '상품 보내기'}
                    {managementAction === 'takeItem' && '상품 가져오기'}
                </DialogTitle>
                <DialogDescription>
                    {selectedStudent?.displayName} 학생에게 작업을 수행합니다.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                {(managementAction === 'sendPoints' || managementAction === 'takePoints') && (
                    <div className="space-y-2">
                        <Label htmlFor="manage-points">포인트</Label>
                        <Input 
                            id="manage-points"
                            type="number"
                            value={managementAmount}
                            onChange={(e) => setManagementAmount(parseInt(e.target.value) || 0)}
                        />
                    </div>
                )}
                 {(managementAction === 'sendItem' || managementAction === 'takeItem') && (
                    <>
                        <div className="space-y-2">
                            <Label>상품</Label>
                            <Select 
                                onValueChange={setManagementItem}
                                disabled={managementAction === 'takeItem' && (!selectedStudent?.inventory || Object.keys(selectedStudent.inventory).length === 0)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="상품 선택..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {managementAction === 'sendItem' && sellingItems.map(item => (
                                        <SelectItem key={item.id} value={item.name}>{item.name} (재고: {item.quantity})</SelectItem>
                                    ))}
                                    {managementAction === 'takeItem' && selectedStudent?.inventory && Object.keys(selectedStudent.inventory).map(itemName => (
                                        <SelectItem key={itemName} value={itemName}>{itemName} (보유: {selectedStudent.inventory?.[itemName].quantity})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="manage-quantity">수량</Label>
                            <Input 
                                id="manage-quantity"
                                type="number"
                                min="1"
                                value={managementAmount}
                                onChange={(e) => setManagementAmount(parseInt(e.target.value) || 1)}
                            />
                        </div>
                    </>
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setManagementAction(null)}>취소</Button>
                <Button onClick={handleManagementAction} disabled={isManagementLoading}>
                    {isManagementLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : '확인'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
     {/* Selling Item Management Dialog */}
    <Dialog open={!!selectedSellingItem} onOpenChange={(isOpen) => !isOpen && setSelectedSellingItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>판매 상품 관리: {selectedSellingItem?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="manage">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manage">정보 수정</TabsTrigger>
              <TabsTrigger value="buyers">구매자 목록</TabsTrigger>
            </TabsList>
            <TabsContent value="manage" className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="item-desc">설명</Label>
                  <Textarea 
                    id="item-desc"
                    value={editItemDescription}
                    onChange={(e) => setEditItemDescription(e.target.value)}
                    placeholder="상품 설명을 입력하세요."
                  />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="item-price">가격</Label>
                  <Input 
                    id="item-price"
                    type="number"
                    min="0"
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-quantity">수량</Label>
                  <Input 
                    id="item-quantity"
                    type="number"
                    min="0"
                    value={editItemQuantity}
                    onChange={(e) => setEditItemQuantity(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <DialogFooter className="mt-6 gap-2">
                <Button variant="destructive" onClick={handleDeleteSellingItem}><Trash2 className="mr-2 h-4 w-4" /> 판매 중지</Button>
                <Button onClick={handleUpdateSellingItem}><Save className="mr-2 h-4 w-4" /> 정보 저장</Button>
              </DialogFooter>
            </TabsContent>
            <TabsContent value="buyers" className="pt-4">
              {isBuyersLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : itemBuyers.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  아직 이 상품을 구매한 학생이 없습니다.
                </div>
              ) : (
                <ScrollArea className="h-64">
                    {itemBuyers.map(buyer => (
                        <div key={buyer.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                             <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                    <AvatarFallback>{buyer.nickname.substring(0,1)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{buyer.nickname}</p>
                                    <p className="text-xs text-muted-foreground">{buyer.name}</p>
                                </div>
                            </div>
                            <p className="text-sm font-medium">보유 수량: {buyer.quantity}</p>
                        </div>
                    ))}
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
    </Dialog>
    </>
  );
}
