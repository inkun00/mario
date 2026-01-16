
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
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
} from 'firebase/firestore';
import type { User, ClassStoreItem, PointLog } from '@/lib/types';
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
} from 'lucide-react';
import Link from 'next/link';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Skeleton } from '@/components/ui/skeleton';

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
        setClassmates(members.filter((m) => m.uid !== teacherId));
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

  const allStudentsSelected = classmates.length > 0 && Object.keys(selectedStudents).length === classmates.length && Object.values(selectedStudents).every(v => v);

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
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">학급 인원</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{classmates.length}명</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">유통된 총 포인트</CardTitle>
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                        <div className="text-2xl font-bold">{totalClassPoints.toLocaleString()} P</div>
                        </CardContent>
                    </Card>
                    <Card>
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
                  pixels={teacher.pixelAvatar ? JSON.parse(teacher.pixelAvatar) : null}
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
            총 {classmates.length}명의 친구들이 함께하고 있습니다.
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
                  } catch (e) {}
                }
                return (
                  <div
                    key={member.uid}
                    className="flex flex-col items-center gap-2 text-center"
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
    </div>
  );
}

    