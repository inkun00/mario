

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  addDoc,
  serverTimestamp,
  getDoc,
  runTransaction,
  increment,
  collectionGroup,
  getDocs,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { User, ClassStoreItem, ItemBuyer, PointLog } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Store,
  Package,
  History,
  PlusCircle,
  Gem,
  Trash2,
  Users,
  ShoppingBag,
  Send,
  Gift,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import Link from 'next/link';
import { Combobox } from '@/components/ui/combobox';

const storeItemSchema = z.object({
  name: z.string().min(1, '아이템 이름을 입력해주세요.').max(20, '아이템 이름은 20자 이내여야 합니다.'),
  description: z.string().min(1, '아이템 설명을 입력해주세요.').max(100, '설명은 100자 이내여야 합니다.'),
  price: z.coerce.number().min(0, '가격은 0 이상이어야 합니다.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
  emoji: z.string().optional(),
});

type StoreItemFormValues = z.infer<typeof storeItemSchema>;
type InventoryItem = NonNullable<User['inventory']>[string];

export default function ClassStorePage() {
  const [user, loadingUser] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [classStoreItems, setClassStoreItems] = useState<ClassStoreItem[]>([]);
  const [myInventory, setMyInventory] = useState<User['inventory'] | null>(null);

  const [activeTab, setActiveTab] = useState('store');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [buyCandidate, setBuyCandidate] = useState<ClassStoreItem | null>(null);
  const [manageSellingItem, setManageSellingItem] = useState<ClassStoreItem | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ClassStoreItem | null>(null);
  const [buyers, setBuyers] = useState<ItemBuyer[]>([]);
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false);

  const [useCandidate, setUseCandidate] = useState<InventoryItem | null>(null);
  const [giftCandidate, setGiftCandidate] = useState<InventoryItem | null>(null);
  const [refundCandidate, setRefundCandidate] = useState<InventoryItem | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [classmates, setClassmates] = useState<{ value: string; label: string }[]>([]);

  const { toast } = useToast();

  const form = useForm<StoreItemFormValues>({
    resolver: zodResolver(storeItemSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      quantity: 1,
      emoji: '🎁',
    },
  });

  useEffect(() => {
    if (loadingUser) return;
    if (!user) {
      setIsLoading(false);
      return;
    }
    const unsub = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        const data = doc.data() as User;
        setUserData(data);
        setMyInventory(data.inventory || {});
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, [user, loadingUser]);

  useEffect(() => {
    if (!userData?.classId) {
        if (!loadingUser && !isLoading) {
            setClassStoreItems([]);
        }
        return;
    };

    const itemsQuery = query(
      collection(db, 'class-store-items'),
      where('classId', '==', userData.classId)
    );
    const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
      const items = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as ClassStoreItem)
      );
      items.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setClassStoreItems(items);
    });
    return () => unsubscribe();
  }, [userData, loadingUser, isLoading]);

  useEffect(() => {
    if (!userData?.classId || !user) return;

    const fetchClassmates = async () => {
        const members: { value: string; label: string; }[] = [];
        const isTeacher = userData.role === 'teacher';
        const classIdForQuery = isTeacher ? userData.uid : userData.classId;

        if (classIdForQuery) {
            const classmatesQuery = query(
              collection(db, 'users'),
              where('classId', '==', classIdForQuery)
            );
            const classmatesSnapshot = await getDocs(classmatesQuery);
            const studentMembers = classmatesSnapshot.docs
              .map(doc => doc.data() as User)
              .filter(member => member.uid !== user?.uid);
            members.push(...studentMembers.map(m => ({ value: m.uid, label: `${m.name || m.displayName}` })));

            if (!isTeacher && userData.classId) {
                const teacherRef = doc(db, 'users', userData.classId);
                const teacherSnap = await getDoc(teacherRef);
                if (teacherSnap.exists()) {
                    const teacherData = teacherSnap.data() as User;
                    members.push({ value: teacherData.uid, label: `${teacherData.name || teacherData.displayName} (선생님)` });
                }
            }
        }
        setClassmates(members);
    };

    fetchClassmates();
  }, [userData, user]);

  const handleAddItem = async (values: StoreItemFormValues) => {
    if (!user || !userData?.classId) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'class-store-items'), {
        ...values,
        sellerId: user.uid,
        sellerName: userData.name,
        sellerNickname: userData.displayName,
        classId: userData.classId,
        createdAt: serverTimestamp(),
      });
      toast({ title: '성공', description: '새로운 아이템을 판매 목록에 추가했습니다.' });
      setShowAddItemDialog(false);
      form.reset();
    } catch (error) {
      console.error('Error adding item:', error);
      toast({ variant: 'destructive', title: '오류', description: '아이템 추가 중 오류가 발생했습니다.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyItem = async () => {
    if (!user || !userData || !buyCandidate) return;

    if ((userData.classPoints || 0) < buyCandidate.price) {
      toast({ variant: 'destructive', title: '포인트 부족', description: '학급 포인트가 부족하여 아이템을 구매할 수 없습니