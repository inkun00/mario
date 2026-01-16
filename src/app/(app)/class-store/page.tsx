
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
import { Skeleton } from '@/components/ui/skeleton';
import { v4 as uuidv4 } from 'uuid';
import Link from 'next/link';

const storeItemSchema = z.object({
  name: z.string().min(1, '아이템 이름을 입력해주세요.').max(20, '아이템 이름은 20자 이내여야 합니다.'),
  description: z.string().min(1, '아이템 설명을 입력해주세요.').max(100, '설명은 100자 이내여야 합니다.'),
  price: z.coerce.number().min(0, '가격은 0 이상이어야 합니다.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
  emoji: z.string().optional(),
});

type StoreItemFormValues = z.infer<typeof storeItemSchema>;

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
      toast({ variant: 'destructive', title: '포인트 부족', description: '학급 포인트가 부족하여 아이템을 구매할 수 없습니다.' });
      return;
    }
    if(buyCandidate.sellerId === user.uid) {
      toast({ variant: 'destructive', title: '구매 불가', description: '자신이 판매하는 아이템은 구매할 수 없습니다.' });
      return;
    }

    setIsPurchasing(true);
    try {
      await runTransaction(db, async (transaction) => {
        const buyerRef = doc(db, 'users', user.uid);
        const sellerRef = doc(db, 'users', buyCandidate.sellerId);
        const itemRef = doc(db, 'class-store-items', buyCandidate.id);
        
        const [buyerDoc, itemDoc] = await Promise.all([
          transaction.get(buyerRef),
          transaction.get(itemRef)
        ]);

        if (!buyerDoc.exists() || !itemDoc.exists()) throw new Error('사용자 또는 아이템 정보를 찾을 수 없습니다.');

        const buyerData = buyerDoc.data() as User;
        const currentItemData = itemDoc.data() as ClassStoreItem;
        if (currentItemData.quantity < 1) throw new Error('아이템 재고가 부족합니다.');
        
        // 1. Update points
        transaction.update(buyerRef, { classPoints: increment(-buyCandidate.price) });
        transaction.update(sellerRef, { classPoints: increment(buyCandidate.price) });

        // 2. Update item quantity
        transaction.update(itemRef, { quantity: increment(-1) });

        // 3. Update buyer's inventory
        const cleanItemName = buyCandidate.name.replace(/[.$#[\]/]/g, '_');
        const itemInInventory = buyerData.inventory?.[cleanItemName];
        
        if (itemInInventory) {
            const inventoryPath = `inventory.${cleanItemName}.quantity`;
            transaction.update(buyerRef, { [inventoryPath]: increment(1) });
        } else {
            const inventoryPath = `inventory.${cleanItemName}`;
            transaction.update(buyerRef, {
                [inventoryPath]: {
                    name: buyCandidate.name,
                    itemId: buyCandidate.id,
                    quantity: 1,
                    description: buyCandidate.description,
                    sellerId: buyCandidate.sellerId,
                    sellerNickname: buyCandidate.sellerNickname,
                    price: buyCandidate.price,
                    emoji: buyCandidate.emoji || '🎁',
                }
            });
        }

        // 4. Add point logs for both buyer and seller
        const buyerLogRef = doc(collection(db, 'users', user.uid, 'pointLogs'));
        transaction.set(buyerLogRef, {
          id: buyerLogRef.id,
          userId: user.uid,
          type: 'ITEM_PURCHASE',
          amount: -buyCandidate.price,
          timestamp: serverTimestamp(),
          description: `'${buyCandidate.name}' 구매`,
          relatedItemId: buyCandidate.id,
          relatedUserId: buyCandidate.sellerId,
        } as PointLog);

        const sellerLogRef = doc(collection(db, 'users', buyCandidate.sellerId, 'pointLogs'));
        transaction.set(sellerLogRef, {
          id: sellerLogRef.id,
          userId: buyCandidate.sellerId,
          type: 'ITEM_SALE',
          amount: buyCandidate.price,
          timestamp: serverTimestamp(),
          description: `'${buyCandidate.name}' 판매`,
          relatedItemId: buyCandidate.id,
          relatedUserId: user.uid,
        } as PointLog);
      });
      toast({ title: '구매 완료!', description: `"${buyCandidate.name}" 아이템을 성공적으로 구매했습니다.` });
      setBuyCandidate(null);
    } catch (e: any) {
      console.error('Purchase error:', e);
      toast({ variant: 'destructive', title: '구매 실패', description: e.message || '아이템 구매 중 오류가 발생했습니다.' });
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleManageSellingItem = async (item: ClassStoreItem) => {
    setManageSellingItem(item);
    setIsLoadingBuyers(true);
    setBuyers([]);

    try {
        const q = query(
            collectionGroup(db, 'pointLogs'),
            where('relatedItemId', '==', item.id),
            where('type', '==', 'ITEM_PURCHASE')
        );

        const querySnapshot = await getDocs(q);
        const buyerPromises = querySnapshot.docs.map(async (logDoc) => {
            const logData = logDoc.data() as PointLog;
            const userDocRef = doc(db, 'users', logData.userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                return {
                    uid: userData.uid,
                    name: userData.name || '',
                    nickname: userData.displayName,
                    quantity: 1
                };
            }
            return null;
        });

        const resolvedBuyers = (await Promise.all(buyerPromises)).filter(b => b !== null) as ItemBuyer[];

        const aggregatedBuyers = resolvedBuyers.reduce((acc, buyer) => {
            if (acc[buyer.uid]) {
                acc[buyer.uid].quantity += buyer.quantity;
            } else {
                acc[buyer.uid] = buyer;
            }
            return acc;
        }, {} as Record<string, ItemBuyer>);

        setBuyers(Object.values(aggregatedBuyers));
    } catch (error) {
        console.error("Error fetching buyers:", error);
        toast({
            variant: "destructive",
            title: "오류",
            description: "구매자 목록을 불러오는 중 오류가 발생했습니다."
        });
    } finally {
        setIsLoadingBuyers(false);
    }
  };
  
  const handleDeleteItem = async () => {
    if (!deleteCandidate) return;

    try {
        if (deleteCandidate.quantity > 0) {
            const itemRef = doc(db, 'class-store-items', deleteCandidate.id);
            const sellerRef = doc(db, 'users', deleteCandidate.sellerId);
            
            await runTransaction(db, async (transaction) => {
                const itemDoc = await transaction.get(itemRef);
                if (!itemDoc.exists()) throw new Error("아이템을 찾을 수 없습니다.");
                const itemData = itemDoc.data() as ClassStoreItem;
                const refundAmount = itemData.price * itemData.quantity;

                transaction.delete(itemRef);
                transaction.update(sellerRef, { classPoints: increment(-refundAmount) });

                const refundLogRef = doc(collection(db, 'users', deleteCandidate.sellerId, 'pointLogs'));
                transaction.set(refundLogRef, {
                    id: refundLogRef.id,
                    userId: deleteCandidate.sellerId,
                    type: 'ITEM_REFUND_SELLER',
                    amount: -refundAmount,
                    timestamp: serverTimestamp(),
                    description: `'${itemData.name}' 판매 취소 및 환불`
                } as PointLog);
            });
            toast({ title: '삭제 및 환불 완료', description: `아이템 판매를 취소하고 남은 재고에 대한 포인트를 환불했습니다.` });
        } else {
            await deleteDoc(doc(db, 'class-store-items', deleteCandidate.id));
            toast({ title: '삭제 완료', description: '아이템을 삭제했습니다.' });
        }
        
        setDeleteCandidate(null);
        setManageSellingItem(null);
    } catch (e: any) {
        console.error("Error deleting item:", e);
        toast({ variant: 'destructive', title: '삭제 실패', description: e.message || '아이템 삭제 중 오류가 발생했습니다.'});
    }
  }


  if (isLoading || loadingUser) {
    return <div className="container mx-auto text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto"/></div>
  }
  
  if (!user || !userData?.classId) {
      return (
          <div className="container mx-auto py-8">
              <Card className="text-center">
                  <CardHeader>
                      <CardTitle>학급에 먼저 참여해주세요</CardTitle>
                      <CardDescription>
                          학급 매점은 소속된 학급이 있어야 이용할 수 있습니다.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <Button asChild>
                          <Link href="/profile">마이페이지에서 학급 참여하기</Link>
                      </Button>
                  </CardContent>
              </Card>
          </div>
      );
  }

  const mySellingItems = classStoreItems.filter(item => item.sellerId === user.uid);

  return (
    <>
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl flex items-center gap-2">
              <Store className="w-6 h-6 text-primary" />
              학급 매점
            </CardTitle>
            <CardDescription>
              학급 친구들이 판매하는 아이템을 구매하거나, 나만의 아이템을 판매하여 학급 포인트를 얻으세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="store"><ShoppingBag className="w-4 h-4 mr-2"/>매점</TabsTrigger>
                <TabsTrigger value="inventory"><Package className="w-4 h-4 mr-2"/>내 보관함</TabsTrigger>
                <TabsTrigger value="sales"><History className="w-4 h-4 mr-2"/>내 판매 관리</TabsTrigger>
              </TabsList>
              
              {/* Store Tab */}
              <TabsContent value="store" className="mt-4">
                {classStoreItems.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground">아직 매점에 등록된 상품이 없습니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {classStoreItems.filter(item => item.quantity > 0).map(item => (
                      <Card key={item.id} className="flex flex-col">
                        <CardHeader className="text-center">
                          <span className="text-5xl mx-auto">{item.emoji || '🎁'}</span>
                          <CardTitle className="text-lg font-semibold">{item.name}</CardTitle>
                          <CardDescription className="text-xs">판매자: {item.sellerNickname}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                          <p className="text-sm text-muted-foreground h-16 overflow-hidden">{item.description}</p>
                        </CardContent>
                        <CardFooter className="flex justify-between items-center">
                          <div className="font-bold text-primary flex items-center gap-1">
                            <Gem className="w-4 h-4" />{item.price.toLocaleString()}
                          </div>
                          <Button size="sm" onClick={() => setBuyCandidate(item)} disabled={item.sellerId === user.uid}>구매</Button>
                        </CardFooter>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Inventory Tab */}
              <TabsContent value="inventory" className="mt-4">
                 {myInventory && Object.keys(myInventory).length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {Object.entries(myInventory).map(([key, item]) => (
                            <Card key={item.itemId} className="flex flex-col">
                                <CardHeader className="text-center">
                                    <span className="text-5xl mx-auto">{item.emoji || '🎁'}</span>
                                    <CardTitle className="text-lg font-semibold">{item.name || key.replace(/_/g, '.')}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </CardContent>
                                <CardFooter className="flex justify-center items-center">
                                    <div className="font-bold text-lg">x {item.quantity}</div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                 ) : (
                    <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">보관함이 비어있습니다. 매점에서 아이템을 구매해보세요!</p>
                    </div>
                 )}
              </TabsContent>

              {/* My Sales Tab */}
              <TabsContent value="sales" className="mt-4">
                <div className="flex justify-end mb-4">
                  <Button onClick={() => setShowAddItemDialog(true)}>
                    <PlusCircle className="w-4 h-4 mr-2" /> 새 아이템 판매
                  </Button>
                </div>
                {mySellingItems.length === 0 ? (
                   <div className="text-center py-12 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">아직 판매 중인 아이템이 없습니다.</p>
                   </div>
                ) : (
                  <div className="space-y-2">
                    {mySellingItems.map(item => (
                      <Card key={item.id}>
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <span className="text-3xl">{item.emoji || '🎁'}</span>
                            <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-sm text-muted-foreground">
                                가격: {item.price}P · 남은 수량: {item.quantity}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleManageSellingItem(item)}>판매 내역</Button>
                            <Button variant="destructive" size="icon" onClick={() => setDeleteCandidate(item)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      
      {/* Add Item Dialog */}
      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 아이템 판매</DialogTitle>
            <DialogDescription>판매할 아이템의 정보를 입력해주세요.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddItem)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>아이템 이름</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>아이템 설명</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem><FormLabel>가격 (포인트)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem><FormLabel>수량</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <FormField control={form.control} name="emoji" render={({ field }) => (
                <FormItem><FormLabel>이모지</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setShowAddItemDialog(false)}>취소</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
                  판매 시작
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Buy Confirmation Dialog */}
      <AlertDialog open={!!buyCandidate} onOpenChange={() => setBuyCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>아이템 구매 확인</AlertDialogTitle>
            <AlertDialogDescription>
              '{buyCandidate?.name}' 아이템을 <span className="font-bold text-primary">{buyCandidate?.price.toLocaleString()}</span> 포인트로 구매하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleBuyItem} disabled={isPurchasing}>
              {isPurchasing && <Loader2 className="w-4 h-4 mr-2 animate-spin"/>}
              구매하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Manage Selling Item Dialog */}
      <Dialog open={!!manageSellingItem} onOpenChange={() => setManageSellingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>'{manageSellingItem?.name}' 판매 내역</DialogTitle>
            <DialogDescription>이 아이템을 구매한 학생들의 목록입니다.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto py-4">
            {isLoadingBuyers ? (
              <div className="text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto"/></div>
            ) : buyers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">아직 구매한 학생이 없습니다.</p>
            ) : (
              <ul className="space-y-2">
                {buyers.map(buyer => (
                  <li key={buyer.uid} className="flex justify-between items-center p-2 rounded-md bg-secondary">
                    <span>{buyer.nickname} ({buyer.name})</span>
                    <span className="font-semibold">x{buyer.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
              <Button variant="destructive" onClick={() => setDeleteCandidate(manageSellingItem)}>아이템 판매 중지</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Item Confirmation */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>정말 판매를 중지하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                      '{deleteCandidate?.name}' 아이템 판매를 중지합니다. 남은 재고({deleteCandidate?.quantity}개)가 있다면, 해당 포인트({(deleteCandidate?.price || 0) * (deleteCandidate?.quantity || 0)}P)는 환불(차감)됩니다. 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteItem} className="bg-destructive hover:bg-destructive/90">판매 중지</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
