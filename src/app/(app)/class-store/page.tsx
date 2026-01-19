
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  updateDoc,
  deleteField,
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
  MinusCircle,
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
import { v4 as uuidv4 } from 'uuid';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const storeItemSchema = z.object({
  name: z.string().min(1, '아이템 이름을 입력해주세요.').max(20, '아이템 이름은 20자 이내여야 합니다.'),
  description: z.string().min(1, '아이템 설명을 입력해주세요.').max(100, '설명은 100자 이내여야 합니다.'),
  price: z.coerce.number().min(0, '가격은 0 이상이어야 합니다.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
  emoji: z.string().optional(),
});

type StoreItemFormValues = z.infer<typeof storeItemSchema>;
type InventoryItem = NonNullable<User['inventory']>[string] & { itemId: string };

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
  const [isPurchasing, setIsPurchasing] = useState(false);
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
  
  const [adjustQuantityCandidate, setAdjustQuantityCandidate] = useState<ClassStoreItem | null>(null);
  const [newQuantity, setNewQuantity] = useState(0);

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
      items.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setClassStoreItems(items);
    });
    return () => unsubscribe();
  }, [userData, loadingUser, isLoading]);

  useEffect(() => {
    if (!userData?.classId || !user) return;

    const fetchClassmates = async () => {
        const members: { value: string; label: string; }[] = [];
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
    const newItemData = {
        ...values,
        sellerId: user.uid,
        sellerName: userData.name,
        sellerNickname: userData.displayName,
        classId: userData.classId,
        createdAt: serverTimestamp(),
      };

    addDoc(collection(db, 'class-store-items'), newItemData)
    .then(() => {
      toast({ title: '성공', description: '새로운 아이템을 판매 목록에 추가했습니다.' });
      setShowAddItemDialog(false);
      form.reset();
    })
    .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'class-store-items',
            operation: 'create',
            requestResourceData: newItemData,
        }));
    })
    .finally(() => {
      setIsSubmitting(false);
    });
  };

  const handleBuyItem = async () => {
    if (!user || !userData || !buyCandidate) return;

    if ((userData.classPoints || 0) < buyCandidate.price) {
      toast({ variant: 'destructive', title: '포인트 부족', description: '학급 포인트가 부족하여 아이템을 구매할 수 없습니다.' });
      return;
    }

    if (buyCandidate.quantity <= 0) {
      toast({ variant: 'destructive', title: '품절', description: '아이템의 재고가 없습니다.' });
      return;
    }

    setIsPurchasing(true);
    
    runTransaction(db, async (transaction) => {
        const buyerRef = doc(db, 'users', user.uid);
        const sellerRef = doc(db, 'users', buyCandidate.sellerId);
        const itemRef = doc(db, 'class-store-items', buyCandidate.id);

        const [itemDoc, buyerDoc, sellerDoc] = await Promise.all([
            transaction.get(itemRef),
            transaction.get(buyerRef),
            transaction.get(sellerRef)
        ]);

        if (!itemDoc.exists() || itemDoc.data().quantity < 1) {
            throw '이 아이템은 품절되었거나 더 이상 사용할 수 없습니다.';
        }
        if (!buyerDoc.exists()) {
            throw "구매자 정보를 찾을 수 없습니다.";
        }
        if (!sellerDoc.exists()) {
            throw '판매자 정보를 찾을 수 없습니다.';
        }
        
        const buyerData = buyerDoc.data() as User;
        const price = buyCandidate.price;

        if ((buyerData.classPoints || 0) < price) {
          throw '학급 포인트가 부족하여 아이템을 구매할 수 없습니다.';
        }

        transaction.update(buyerRef, { classPoints: increment(-price) });
        transaction.update(sellerRef, { classPoints: increment(price) });
        transaction.update(itemRef, { quantity: increment(-1) });

        const inventoryItemId = buyCandidate.id;
        const newInventoryItem = {
            name: buyCandidate.name,
            itemId: buyCandidate.id,
            quantity: 1,
            description: buyCandidate.description,
            sellerId: buyCandidate.sellerId,
            sellerNickname: buyCandidate.sellerNickname,
            price: buyCandidate.price,
            emoji: buyCandidate.emoji,
        };
        const inventoryPath = `inventory.${inventoryItemId}`;
        const existingItem = buyerData.inventory?.[inventoryItemId];

        if (existingItem) {
            transaction.update(buyerRef, { [`${inventoryPath}.quantity`]: increment(1) });
        } else {
            transaction.set(buyerRef, { inventory: { [inventoryItemId]: newInventoryItem } }, { merge: true });
        }

        const buyerLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(buyerLogRef, {
            type: 'ITEM_PURCHASE',
            amount: -price,
            timestamp: serverTimestamp(),
            description: `'${buyCandidate.name}' 구매`,
            relatedItemId: buyCandidate.id,
        });

        const sellerLogRef = doc(collection(db, 'users', buyCandidate.sellerId, 'pointLogs'));
        transaction.set(sellerLogRef, {
            type: 'ITEM_SALE',
            amount: price,
            timestamp: serverTimestamp(),
            description: `'${buyCandidate.name}' 판매`,
            relatedItemId: buyCandidate.id,
        });
    })
    .then(() => {
      toast({ title: '구매 완료!', description: `${buyCandidate.name} 아이템을 구매했습니다.` });
    })
    .catch((error: any) => {
        if (typeof error === 'string') {
          toast({ variant: 'destructive', title: '구매 실패', description: error });
        } else {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `users/${user.uid} and/or users/${buyCandidate.sellerId}`,
              operation: 'write',
              requestResourceData: {
                buyerId: user.uid,
                sellerId: buyCandidate.sellerId,
                itemId: buyCandidate.id,
                price: buyCandidate.price
              },
          }));
        }
    })
    .finally(() => {
        setIsPurchasing(false);
        setBuyCandidate(null);
    });
  };

  const handleDeleteItem = async () => {
    if (!deleteCandidate) return;
    deleteDoc(doc(db, "class-store-items", deleteCandidate.id))
        .then(() => {
            toast({ title: "삭제 완료", description: "판매 목록에서 아이템을 삭제했습니다." });
        })
        .catch(() => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `class-store-items/${deleteCandidate.id}`,
                operation: 'delete',
            }));
        })
        .finally(() => {
            setDeleteCandidate(null);
        });
  };
  
  const handleManageSellingItem = async (item: ClassStoreItem) => {
    setManageSellingItem(item);
    setIsLoadingBuyers(true);
    try {
      const q = query(
        collectionGroup(db, 'pointLogs'), 
        where('relatedItemId', '==', item.id),
        where('type', '==', 'ITEM_PURCHASE')
      );
      const querySnapshot = await getDocs(q);
      
      const buyerPurchaseCounts: Record<string, number> = {};
      querySnapshot.docs.forEach(doc => {
          const buyerId = doc.ref.parent.parent?.id;
          if (buyerId) {
              buyerPurchaseCounts[buyerId] = (buyerPurchaseCounts[buyerId] || 0) + 1;
          }
      });
      
      const uniqueBuyerIds = Object.keys(buyerPurchaseCounts);

      if (uniqueBuyerIds.length > 0) {
        const usersQuery = query(collection(db, 'users'), where('uid', 'in', uniqueBuyerIds));
        const usersSnapshot = await getDocs(usersQuery);
        const buyersData = usersSnapshot.docs.map(doc => {
            const user = doc.data() as User;
            return { 
                uid: user.uid, 
                name: user.name || user.displayName || '이름없음',
                quantity: buyerPurchaseCounts[user.uid] || 0
            };
        });
        setBuyers(buyersData);
      } else {
        setBuyers([]);
      }
    } catch (error) {
        console.error("Error fetching buyers: ", error);
    } finally {
        setIsLoadingBuyers(false);
    }
  };

  const handleUseItem = async () => {
    if (!user || !useCandidate) return;
    
    setIsProcessing(true);
    runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";
        
        const userData = userDoc.data() as User;
        const itemInInventory = userData.inventory?.[useCandidate.itemId];

        if (!itemInInventory || itemInInventory.quantity < 1) {
            throw "사용할 아이템이 보관함에 없습니다.";
        }
        
        const itemNameToUse = itemInInventory.name || '이름 없는 아이템';
        
        const newQuantity = itemInInventory.quantity - 1;
        if (newQuantity > 0) {
            transaction.update(userRef, { [`inventory.${useCandidate.itemId}.quantity`]: newQuantity });
        } else {
            transaction.update(userRef, { [`inventory.${useCandidate.itemId}`]: deleteField() });
        }
        
        const logRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(logRef, {
            type: 'ITEM_USE',
            amount: 0,
            timestamp: serverTimestamp(),
            description: `'${itemNameToUse}' 사용`,
            relatedItemId: useCandidate.itemId,
        });
        
        return { name: itemNameToUse };
    })
    .then(({ name }) => {
        toast({ title: "사용 완료", description: `'${name}' 아이템을 사용했습니다.`});
    })
    .catch((error: any) => {
        if (typeof error === 'string') {
          toast({ variant: 'destructive', title: '사용 실패', description: error });
        } else {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${user.uid}`,
                operation: 'update',
                requestResourceData: { inventoryUpdate: { [useCandidate.itemId]: 'DECREMENT or DELETE' } }
            }));
        }
    })
    .finally(() => {
        setIsProcessing(false);
        setUseCandidate(null);
    });
  };

  const handleGiftItem = async () => {
    if (!user || !giftCandidate || !giftRecipient || giftQuantity <= 0) {
      toast({ variant: 'destructive', title: '오류', description: '선물 정보를 올바르게 입력해주세요.'});
      return;
    }
    
    setIsProcessing(true);
    runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user.uid);
        const recipientRef = doc(db, 'users', giftRecipient);
        
        const [senderDoc, recipientDoc] = await Promise.all([
            transaction.get(senderRef),
            transaction.get(recipientRef),
        ]);
        
        if (!senderDoc.exists() || !recipientDoc.exists()) throw "사용자를 찾을 수 없습니다.";
        
        const senderData = senderDoc.data() as User;
        const itemInInventory = senderData.inventory?.[giftCandidate.itemId];

        if (!itemInInventory || itemInInventory.quantity < giftQuantity) {
            throw "선물할 아이템의 수량이 부족합니다.";
        }

        const newSenderQuantity = itemInInventory.quantity - giftQuantity;
        if (newSenderQuantity > 0) {
            transaction.update(senderRef, { [`inventory.${giftCandidate.itemId}.quantity`]: newSenderQuantity });
        } else {
            transaction.update(senderRef, { [`inventory.${giftCandidate.itemId}`]: deleteField() });
        }
        
        const recipientData = recipientDoc.data() as User;
        const itemInRecipientInventory = recipientData.inventory?.[giftCandidate.itemId];
        
        const itemNameToUse = itemInInventory.name || '이름 없는 아이템';
        const newRecipientItem = { ...itemInInventory, name: itemNameToUse, quantity: giftQuantity };

        if (itemInRecipientInventory) {
            transaction.update(recipientRef, { [`inventory.${giftCandidate.itemId}.quantity`]: increment(giftQuantity) });
        } else {
              transaction.set(recipientRef, { inventory: { [giftCandidate.itemId]: newRecipientItem } }, { merge: true });
        }
        
        const senderLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(senderLogRef, {
            type: 'ITEM_GIFT_SEND', amount: 0, timestamp: serverTimestamp(),
            description: `'${itemNameToUse}' ${giftQuantity}개 선물 (${recipientData.displayName}에게)`,
            relatedItemId: giftCandidate.itemId, relatedUserId: giftRecipient
        });
        
        const recipientLogRef = doc(collection(db, 'users', giftRecipient, 'pointLogs'));
        transaction.set(recipientLogRef, {
            type: 'ITEM_GIFT_RECEIVE', amount: 0, timestamp: serverTimestamp(),
            description: `'${itemNameToUse}' ${giftQuantity}개 선물 받음 (${senderData.displayName}로부터)`,
            relatedItemId: giftCandidate.itemId, relatedUserId: user.uid
        });

        return { name: itemNameToUse, recipientName: recipientData.displayName || '친구' };
    })
    .then(({ name, recipientName }) => {
        toast({ title: '선물 완료', description: `${recipientName}님에게 '${name}' 아이템을 성공적으로 선물했습니다.`});
    })
    .catch((error: any) => {
        if (typeof error === 'string') {
          toast({ variant: 'destructive', title: '선물 실패', description: error });
        } else {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${user.uid} and users/${giftRecipient}`,
                operation: 'write',
                requestResourceData: {
                  sender: user.uid,
                  recipient: giftRecipient,
                  itemId: giftCandidate.itemId,
                  quantity: giftQuantity,
                }
            }));
        }
    })
    .finally(() => {
        setIsProcessing(false);
        setGiftCandidate(null);
        setGiftQuantity(1);
        setGiftRecipient('');
    });
  };
  
  const handleRefundItem = async () => {
    if (!user || !refundCandidate) return;
    
    setIsProcessing(true);
    runTransaction(db, async (transaction) => {
        const buyerRef = doc(db, 'users', user.uid);
        const buyerDoc = await transaction.get(buyerRef);

        if (!buyerDoc.exists()) throw "구매자 정보를 찾을 수 없습니다.";
        
        const buyerData = buyerDoc.data() as User;
        const itemInInventory = buyerData.inventory?.[refundCandidate.itemId];

        if (!itemInInventory || itemInInventory.quantity < 1) {
            throw "환불할 아이템이 보관함에 없습니다.";
        }

        const sellerId = itemInInventory.sellerId;
        if (!sellerId) throw "판매자 정보가 없어 환불할 수 없습니다.";

        const sellerRef = doc(db, 'users', sellerId);
        const itemRef = doc(db, 'class-store-items', refundCandidate.itemId);

        const [sellerDoc, itemDoc] = await Promise.all([
            transaction.get(sellerRef),
            transaction.get(itemRef)
        ]);
        
        if (!sellerDoc.exists()) throw "판매자를 찾을 수 없어 환불할 수 없습니다.";
        
        const sellerData = sellerDoc.data() as User;
        const refundPrice = itemInInventory.price ?? 0;
        
        if(refundPrice === 0) throw "환불할 수 없는 아이템입니다 (가격 정보 없음).";
        if((sellerData.classPoints || 0) < refundPrice) throw '판매자의 포인트가 부족하여 환불할 수 없습니다.';
        
        const itemNameToUse = itemInInventory.name || '이름 없는 아이템';

        const newQuantity = itemInInventory.quantity - 1;
        if (newQuantity > 0) {
            transaction.update(buyerRef, { [`inventory.${refundCandidate.itemId}.quantity`]: newQuantity });
        } else {
            transaction.update(buyerRef, { [`inventory.${refundCandidate.itemId}`]: deleteField() });
        }

        transaction.update(buyerRef, { classPoints: increment(refundPrice) });
        transaction.update(sellerRef, { classPoints: increment(-refundPrice) });
        if (itemDoc.exists()) {
            transaction.update(itemRef, { quantity: increment(1) });
        }

        const buyerLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(buyerLogRef, {
            type: 'ITEM_REFUND_BUYER', amount: refundPrice, timestamp: serverTimestamp(),
            description: `'${itemNameToUse}' 환불`, relatedItemId: refundCandidate.itemId,
        });

        const sellerLogRef = doc(collection(db, 'users', sellerId, 'pointLogs'));
        transaction.set(sellerLogRef, {
            type: 'ITEM_SALE_REFUND', amount: -refundPrice, timestamp: serverTimestamp(),
            description: `판매된 '${itemNameToUse}' 환불 처리`, relatedItemId: refundCandidate.itemId,
        });

        return { name: itemNameToUse, price: refundPrice };
    })
    .then(({ name, price }) => {
        toast({ title: '환불 완료', description: `'${name}' 아이템이 환불 처리되어 ${price}P를 돌려받았습니다.` });
    })
    .catch((error: any) => {
        if (typeof error === 'string') {
          toast({ variant: 'destructive', title: '환불 실패', description: error });
        } else {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${user.uid} and related docs`,
                operation: 'write',
                requestResourceData: { refundAttempt: { itemId: refundCandidate.itemId } }
            }));
        }
    })
    .finally(() => {
        setIsProcessing(false);
        setRefundCandidate(null);
    });
  };

  const handleAdjustQuantity = async () => {
    if (!adjustQuantityCandidate || newQuantity < 0) {
      toast({ variant: 'destructive', title: '오류', description: '수량은 0 이상이어야 합니다.'});
      return;
    }

    setIsProcessing(true);
    const itemRef = doc(db, 'class-store-items', adjustQuantityCandidate.id);

    updateDoc(itemRef, { quantity: newQuantity })
    .then(() => {
        toast({ title: '성공', description: '아이템 수량이 업데이트되었습니다.' });
    })
    .catch((serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `class-store-items/${adjustQuantityCandidate.id}`,
            operation: 'update',
            requestResourceData: { quantity: newQuantity },
        }));
    })
    .finally(() => {
        setIsProcessing(false);
        setAdjustQuantityCandidate(null);
    });
  };

  const inventoryItems = useMemo(() => 
    Object.entries(myInventory || {}).map(([id, data]) => {
      return {
        ...data,
        itemId: id,
      };
    }).sort((a,b) => (a.name || "").localeCompare(b.name || "")),
  [myInventory]);

  return (
    <>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
              <Store className="text-primary"/>학급 매점
            </CardTitle>
            <CardDescription>
              다른 친구들이 판매하는 아이템을 구매하거나, 내 아이템을 만들어 판매할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto">
                <TabsTrigger value="store">
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  아이템 구매
                </TabsTrigger>
                <TabsTrigger value="inventory">
                  <Package className="w-4 h-4 mr-2" />내 보관함 ({inventoryItems.reduce((sum, item) => sum + (item.quantity || 0), 0)})
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="w-4 h-4 mr-2" />
                  판매 관리
                </TabsTrigger>
              </TabsList>
              <TabsContent value="store" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {classStoreItems.filter(item => item.quantity > 0).map(item => (
                    <Card key={item.id} className="flex flex-col">
                      <CardHeader>
                         <div className="flex justify-between items-start gap-2">
                            <CardTitle className="font-headline">{item.name}</CardTitle>
                            <span className="text-5xl">{item.emoji || '🎁'}</span>
                         </div>
                        <CardDescription>{item.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-1 text-sm">
                        <p className="text-muted-foreground">판매자: {item.sellerNickname}</p>
                        <p className="text-muted-foreground">재고: {item.quantity}개</p>
                      </CardContent>
                      <CardFooter className="flex-col items-stretch gap-2">
                        <div className="flex items-center justify-center font-bold text-lg text-primary">
                          <Gem className="w-5 h-5 mr-2" />
                          <span>{item.price.toLocaleString()}</span>
                        </div>
                        <Button 
                          onClick={() => setBuyCandidate(item)} 
                          disabled={item.sellerId === user?.uid}
                        >
                          <ShoppingBag className="w-4 h-4 mr-2"/>
                          {item.sellerId === user?.uid ? '내 판매 상품' : '구매하기'}
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="inventory" className="mt-6">
                 {inventoryItems.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">보관함이 비어있습니다. 상점에서 아이템을 구매해보세요!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {inventoryItems.map(item => (
                            <Card key={item.itemId} className="flex flex-col bg-secondary/30">
                                <CardHeader>
                                    <div className="flex justify-between items-start gap-2">
                                        <CardTitle className="font-headline">{item.name}</CardTitle>
                                        <span className="text-5xl">{item.emoji || '🎁'}</span>
                                    </div>
                                    <CardDescription>{item.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-1 text-sm">
                                    <p className="text-muted-foreground">판매자: {item.sellerNickname}</p>
                                    <p className="font-semibold">보유 수량: {item.quantity}개</p>
                                </CardContent>
                                <CardFooter className="grid grid-cols-3 gap-2">
                                    <Button size="sm" variant="outline" onClick={() => setUseCandidate(item)}>사용</Button>
                                    <Button size="sm" variant="outline" onClick={() => setGiftCandidate(item)}>선물</Button>
                                    <Button size="sm" variant="destructive" onClick={() => setRefundCandidate(item)}>환불</Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
              </TabsContent>
              <TabsContent value="history" className="mt-6">
                <Button onClick={() => setShowAddItemDialog(true)}>
                  <PlusCircle className="w-4 h-4 mr-2"/>새 아이템 판매하기
                </Button>
                <div className="mt-6 space-y-4">
                  <h3 className="font-headline text-lg">내가 판매 중인 아이템</h3>
                  {classStoreItems.filter(item => item.sellerId === user?.uid).length === 0 ? (
                     <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">판매중인 아이템이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {classStoreItems.filter(item => item.sellerId === user?.uid).map(item => (
                        <Card key={item.id}>
                          <CardHeader>
                            <CardTitle>{item.name}</CardTitle>
                            <CardDescription>재고: {item.quantity} / 가격: {item.price}P</CardDescription>
                          </CardHeader>
                          <CardFooter className="grid grid-cols-3 gap-2">
                            <Button size="sm" onClick={() => handleManageSellingItem(item)}>판매 내역</Button>
                            <Button size="sm" variant="outline" onClick={() => {
                                setAdjustQuantityCandidate(item);
                                setNewQuantity(item.quantity);
                            }}>수량 변경</Button>
                            <Button size="sm" variant="destructive" onClick={() => setDeleteCandidate(item)}>삭제</Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 아이템 판매하기</DialogTitle>
            <DialogDescription>판매할 아이템의 정보를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4 py-2">
              <FormField name="name" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>아이템 이름</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField name="description" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>아이템 설명</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField name="price" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>가격 (포인트)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField name="quantity" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>수량</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
               <FormField name="emoji" control={form.control} render={({ field }) => (
                <FormItem><FormLabel>대표 이모지</FormLabel><FormControl><Input {...field} maxLength={2} /></FormControl><FormMessage /></FormItem>
              )}/>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    판매 시작
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Other Dialogs */}
      <AlertDialog open={!!buyCandidate} onOpenChange={(isOpen) => !isOpen && setBuyCandidate(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>아이템을 구매하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>'{buyCandidate?.name}' 아이템을 {buyCandidate?.price.toLocaleString()} 포인트에 구매합니다.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleBuyItem} disabled={isPurchasing}>
                    {isPurchasing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                    구매
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={!!deleteCandidate} onOpenChange={(isOpen) => !isOpen && setDeleteCandidate(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. '{deleteCandidate?.name}' 아이템 판매가 중단됩니다.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">삭제</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!manageSellingItem} onOpenChange={(isOpen) => !isOpen && setManageSellingItem(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>'{manageSellingItem?.name}' 판매 내역</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                  {isLoadingBuyers ? <Loader2 className="mx-auto h-6 w-6 animate-spin"/> : (
                      buyers.length === 0 
                          ? <p className="text-muted-foreground">아직 구매한 학생이 없습니다.</p>
                          : <ul className="space-y-2">{buyers.map(b => 
                            <li key={b.uid} className="flex justify-between items-center">
                              <span>{b.name}</span>
                              <span className="font-semibold text-primary">{b.quantity}개 구매</span>
                            </li>)}
                           </ul>
                  )}
              </div>
          </DialogContent>
      </Dialog>
      
      {/* Inventory Item Action Dialogs */}
      <AlertDialog open={!!useCandidate} onOpenChange={(isOpen) => !isOpen && setUseCandidate(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>아이템 사용</AlertDialogTitle>
                <AlertDialogDescription>'{useCandidate?.name}' 아이템을 사용하시겠습니까? 이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleUseItem} disabled={isProcessing}>
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} 사용하기
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!giftCandidate} onOpenChange={(isOpen) => !isOpen && setGiftCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>아이템 선물하기</DialogTitle>
            <DialogDescription>'{giftCandidate?.name}' 아이템을 학급 친구에게 선물합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>받는 사람</Label>
              <Combobox options={classmates} value={giftRecipient} onValueChange={setGiftRecipient} placeholder="선물 받을 친구 선택..."/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gift-quantity">수량 (보유: {giftCandidate?.quantity})</Label>
              <Input id="gift-quantity" type="number" min="1" max={giftCandidate?.quantity} value={giftQuantity} onChange={(e) => setGiftQuantity(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGiftCandidate(null)}>취소</Button>
            <Button onClick={handleGiftItem} disabled={isProcessing || !giftRecipient || giftQuantity <= 0}>
               {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} 선물하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!refundCandidate} onOpenChange={(isOpen) => !isOpen && setRefundCandidate(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>아이템 환불</AlertDialogTitle>
                <AlertDialogDescription>'{refundCandidate?.name}' 아이템을 환불하고 {refundCandidate?.price?.toLocaleString()}P를 돌려받으시겠습니까?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleRefundItem} disabled={isProcessing} className="bg-destructive hover:bg-destructive/90">
                  {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>} 환불하기
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!adjustQuantityCandidate} onOpenChange={(isOpen) => !isOpen && setAdjustQuantityCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>'{adjustQuantityCandidate?.name}' 수량 조절</DialogTitle>
            <DialogDescription>
              현재 재고: {adjustQuantityCandidate?.quantity}개. 변경할 수량을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-quantity">새 수량</Label>
            <Input
              id="new-quantity"
              type="number"
              min="0"
              value={newQuantity}
              onChange={(e) => setNewQuantity(parseInt(e.target.value) || 0)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdjustQuantityCandidate(null)}>취소</Button>
            <Button onClick={handleAdjustQuantity} disabled={isProcessing}>
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    
