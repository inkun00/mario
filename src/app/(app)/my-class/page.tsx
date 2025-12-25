'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, getDocs, doc, getDoc, addDoc, serverTimestamp, onSnapshot, Unsubscribe, runTransaction } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User, ClassStoreItem } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Crown, Store, ShoppingCart, Repeat, Save } from 'lucide-react';
import { getLevelInfo } from '@/lib/level-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MotionDiv } from '@/components/motion-div';

const sellItemSchema = z.object({
  name: z.string().min(1, '상품명을 입력해주세요.').max(30, '상품명은 30자 이내로 입력해주세요.'),
  price: z.coerce.number().min(1, '가격은 1 이상이어야 합니다.'),
  description: z.string().min(1, '제품 설명을 입력해주세요.').max(200, '설명은 200자 이내로 입력해주세요.'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다.'),
});

type SellItemFormValues = z.infer<typeof sellItemSchema>;


export default function MyClassPage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [classMembers, setClassMembers] = useState<User[]>([]);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [classStoreItems, setClassStoreItems] = useState<ClassStoreItem[]>([]);
  const [isStoreLoading, setIsStoreLoading] = useState(true);

  const [isSellItemDialogOpen, setIsSellItemDialogOpen] = useState(false);
  const [isBuyItemDialogOpen, setIsBuyItemDialogOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBuying, setIsBuying] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<SellItemFormValues>({
    resolver: zodResolver(sellItemSchema),
    defaultValues: {
      name: '',
      price: 1,
      description: '',
      quantity: 1,
    }
  });

 useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    let unsubscribeStore: Unsubscribe | undefined;

    const fetchClassData = async () => {
      setIsLoading(true);

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const currentUserData = userSnap.data() as User;
        setUserData(currentUserData);

        const targetClassId = currentUserData.role === 'teacher' ? user.uid : currentUserData.classId;

        if (targetClassId) {
          const membersQuery = query(collection(db, 'users'), where('classId', '==', targetClassId));
          const teacherQuery = query(collection(db, 'users'), where('uid', '==', targetClassId));

          const [membersSnapshot, teacherSnapshot] = await Promise.all([
            getDocs(membersQuery),
            getDocs(teacherQuery),
          ]);

          const members = membersSnapshot.docs.map(doc => doc.data() as User);
          
          if (currentUserData.role === 'teacher') {
            setTeacher(currentUserData);
          } else if (!teacherSnapshot.empty) {
            setTeacher(teacherSnapshot.docs[0].data() as User);
          }

          setClassMembers(members.sort((a, b) => b.xp - a.xp));
          
          // Fetch class store items
          setIsStoreLoading(true);
          const storeQuery = query(collection(db, 'class-store-items'), where('classId', '==', targetClassId));
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
        }
      }
      setIsLoading(false);
    };

    fetchClassData();

    return () => {
        if (unsubscribeStore) {
            unsubscribeStore();
        }
    };
  }, [user, toast]);

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

        // 1. Decrement buyer's points
        transaction.update(buyerRef, {
          classPoints: (buyerData.classPoints || 0) - itemData.price,
        });
        
        // 2. Add item to buyer's inventory
        const newInventory = { ...buyerData.inventory };
        const currentQuantity = newInventory[itemData.name]?.quantity || 0;
        newInventory[itemData.name] = { 
            quantity: currentQuantity + 1,
            description: itemData.description
        };
        transaction.update(buyerRef, { inventory: newInventory });

        // 3. Increment seller's points
        transaction.update(sellerRef, {
          classPoints: (sellerData.classPoints || 0) + itemData.price,
        });

        // 4. Decrement item quantity or delete
        if (itemData.quantity > 1) {
          transaction.update(itemRef, {
            quantity: itemData.quantity - 1,
          });
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
                  {teacher.displayName} 선생님의 학급
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
            <Tabs defaultValue="ranking" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ranking">우리 학급 랭킹</TabsTrigger>
                <TabsTrigger value="store">학급 매장</TabsTrigger>
              </TabsList>
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
                        <TableHead>닉네임</TableHead>
                        <TableHead>학교</TableHead>
                        <TableHead className="text-center">레벨</TableHead>
                        <TableHead className="text-right">경험치 (XP)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classMembers.map((member, index) => {
                        const rank = index + 1;
                        const levelInfo = getLevelInfo(member.xp);
                        return (
                          <TableRow key={member.uid} className={member.uid === user?.uid ? 'bg-primary/10' : ''}>
                            <TableCell className="font-bold text-center text-lg">
                              {rank === 1 ? <Crown className="w-6 h-6 mx-auto text-yellow-500 fill-yellow-400" /> : rank}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="flex items-center justify-center bg-muted">
                                  <span className="text-xl">{levelInfo.icon}</span>
                                </Avatar>
                                <span className="font-medium">{member.displayName}</span>
                              </div>
                            </TableCell>
                            <TableCell>{member.schoolName}</TableCell>
                            <TableCell className="text-center font-medium">Lv. {levelInfo.level}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{member.xp.toLocaleString()}</TableCell>
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
                                      <DialogDescription>판매 중인 물품 목록입니다.</DialogDescription>
                                  </DialogHeader>
                                  <ScrollArea className="h-96">
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
                                            <TableHead className="w-[100px]"></TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {classStoreItems.map((item) => (
                                            <TableRow key={item.id}>
                                              <TableCell className="font-medium">{item.name}</TableCell>
                                              <TableCell>{item.sellerNickname}</TableCell>
                                              <TableCell className="text-center">{item.quantity}</TableCell>
                                              <TableCell className="text-right font-bold text-primary">{item.price.toLocaleString()}</TableCell>
                                              <TableCell>
                                                <Button 
                                                  size="sm" 
                                                  disabled={item.sellerId === user?.uid || !!isBuying}
                                                  onClick={() => handleBuyItem(item)}
                                                >
                                                  {isBuying === item.id ? <Loader2 className="w-4 h-4 animate-spin"/> : '구매'}
                                                </Button>
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
                              <DialogContent>
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
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </MotionDiv>
    </>
  );
}
