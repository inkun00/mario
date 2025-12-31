

'use client';

import { Avatar } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { useEffect, useState, useMemo, useCallback } from 'react';
import type { User, IncorrectAnswer, Question, SubjectStat, SolvedIncorrectAnswer } from '@/lib/types';
import { doc, getDoc, collection, getDocs, updateDoc, increment, deleteDoc, query, orderBy, setDoc, serverTimestamp, where, Timestamp, onSnapshot, limit, runTransaction } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Loader2, FileWarning, School, Trophy, BookOpen, BarChart2, CheckCircle, XCircle, Pencil, Save, X, Users, KeyRound, Edit, Gem, Package, Send,MinusCircle, LogOut, Undo2 } from 'lucide-react';
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

const PixelEditor = dynamic(() => import('@/components/pixel-editor').then(mod => mod.PixelEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});


interface ReviewQuestion extends IncorrectAnswer {
    userReviewAnswer?: string;
    isSubmitting?: boolean;
}

const transformStats = (flatStats: SubjectStat[]): SubjectStat[] => {
  return flatStats.map(stat => {
    // If 'units' is already a nested object, it's the new format.
    // We just need to ensure the nested properties exist.
    if (stat.units && typeof stat.units === 'object' && !Array.isArray(stat.units)) {
      const sanitizedStat = {
        ...stat,
        totalCorrect: stat.totalCorrect || 0,
        totalIncorrect: stat.totalIncorrect || 0,
        units: { ...stat.units },
      };
      // Ensure nested unit stats have both counts
      for (const unit in sanitizedStat.units) {
        sanitizedStat.units[unit] = {
          totalCorrect: sanitizedStat.units[unit].totalCorrect || 0,
          totalIncorrect: sanitizedStat.units[unit].totalIncorrect || 0,
        };
      }
      return sanitizedStat;
    }

    // Handle old flattened structure
    const newStat: SubjectStat = {
      id: stat.id,
      totalCorrect: stat.totalCorrect || 0,
      totalIncorrect: stat.totalIncorrect || 0,
      units: {},
    };

    for (const key in stat) {
      if (key.startsWith('units.')) {
        const parts = key.split('.');
        const unitName = parts.slice(1, -1).join('.');
        const metric = parts[parts.length - 1];

        if (unitName && (metric === 'totalCorrect' || metric === 'totalIncorrect')) {
          if (!newStat.units![unitName]) {
            newStat.units![unitName] = { totalCorrect: 0, totalIncorrect: 0 };
          }
          newStat.units![unitName][metric] = (stat[key] as number) || 0;
        }
      }
    }
    return newStat;
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

  const [selectedItem, setSelectedItem] = useState<{name: string, details: {itemId: string, quantity: number, description?: string, sellerId?: string, sellerNickname?: string, price?: number}} | null>(null);
  const [itemAction, setItemAction] = useState<'use' | 'send' | 'refund' | null>(null);
  const [actionQuantity, setActionQuantity] = useState(1);
  const [sendRecipient, setSendRecipient] = useState('');
  const [classmates, setClassmates] = useState<{value: string, label: string}[]>([]);
  const [isItemActionLoading, setIsItemActionLoading] = useState(false);
  
  const [isSendPointsDialogOpen, setIsSendPointsDialogOpen] = useState(false);
  const [sendPointsAmount, setSendPointsAmount] = useState(0);
  const [sendPointsRecipient, setSendPointsRecipient] = useState('');
  const [isSendingPoints, setIsSendingPoints] = useState(false);

  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [currentPixelAvatar, setCurrentPixelAvatar] = useState<string[][] | null>(null);
  const [isRefundConfirmationOpen, setIsRefundConfirmationOpen] = useState(false);
  const [refundCandidate, setRefundCandidate] = useState<{name: string, details: {itemId: string, quantity: number, description?: string, sellerId?: string, sellerNickname?: string, price?: number}} | null>(null);


  const fetchProfileData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);

    const userRef = doc(db, 'users', user.uid);
    const incorrectAnswersRef = collection(db, 'users', user.uid, 'incorrect-answers');
    const solvedIncorrectAnswersRef = collection(db, 'users', user.uid, 'solved-incorrect-answers');
    const subjectStatsRef = collection(db, 'users', user.uid, 'subjectStats');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const [userSnap, incorrectSnapshot, solvedIncorrectSnapshot, subjectStatsSnapshot] = await Promise.all([
        getDoc(userRef),
        getDocs(query(incorrectAnswersRef, where('timestamp', '<=', oneDayAgo), orderBy('timestamp', 'asc'))),
        getDocs(query(solvedIncorrectAnswersRef, orderBy('timestamp', 'desc'))),
        getDocs(subjectStatsRef),
      ]);

      if (userSnap.exists()) {
        const fetchedUserData = userSnap.data() as User;
        setUserData(fetchedUserData);
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

      setReviewQuestions(incorrectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncorrectAnswer)));
      setSolvedReviewQuestions(solvedIncorrectSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SolvedIncorrectAnswer)));
      setSubjectStats(transformStats(subjectStatsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectStat))));
    } catch (error) {
        console.error("Error fetching profile data:", error);
        toast({ variant: 'destructive', title: '오류', description: '프로필 데이터를 불러오는 중 오류가 발생했습니다.' });
    } finally {
        setIsLoading(false);
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
  
  const closeItemDialogs = () => {
    setSelectedItem(null);
    setItemAction(null);
    setActionQuantity(1);
    setSendRecipient('');
  };

  const handleUseItem = async () => {
    if (!user || !selectedItem || actionQuantity <= 0) return;

    setIsItemActionLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";
        
        const currentInventory = userDoc.data().inventory || {};
        const itemToUse = currentInventory[selectedItem.name];

        if (!itemToUse || itemToUse.quantity < actionQuantity) {
          throw "사용할 아이템의 수량이 부족합니다.";
        }

        const newQuantity = itemToUse.quantity - actionQuantity;
        if (newQuantity > 0) {
          currentInventory[selectedItem.name].quantity = newQuantity;
        } else {
          delete currentInventory[selectedItem.name];
        }

        transaction.update(userRef, { inventory: currentInventory });
      });

      toast({ title: "아이템 사용", description: `'${selectedItem.name}' ${actionQuantity}개를 사용했습니다.` });
      // Optimistic update
      setUserData(prev => {
        if (!prev || !selectedItem) return prev;
        const newInventory = {...(prev.inventory || {})};
        const newQuantity = (newInventory[selectedItem.name]?.quantity || 0) - actionQuantity;
        if (newQuantity > 0) {
            newInventory[selectedItem.name].quantity = newQuantity;
        } else {
            delete newInventory[selectedItem.name];
        }
        return {...prev, inventory: newInventory};
      });
      closeItemDialogs();

    } catch (error) {
      toast({ variant: "destructive", title: "오류", description: typeof error === 'string' ? error : "아이템 사용 중 오류가 발생했습니다."});
    } finally {
      setIsItemActionLoading(false);
    }
  };

  const handleSendItem = async () => {
    if (!user || !selectedItem || !sendRecipient || actionQuantity <= 0) {
      toast({ variant: 'destructive', title: '오류', description: '받는 사람과 수량을 확인해주세요.'});
      return;
    };
    
    setIsItemActionLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', user.uid);
        const recipientRef = doc(db, 'users', sendRecipient);

        const [senderDoc, recipientDoc] = await Promise.all([
          transaction.get(senderRef),
          transaction.get(recipientRef)
        ]);

        if (!senderDoc.exists() || !recipientDoc.exists()) throw "사용자 정보를 찾을 수 없습니다.";
        
        // Sender logic
        const senderInventory = senderDoc.data().inventory || {};
        const itemToSend = senderInventory[selectedItem.name];

        if (!itemToSend || itemToSend.quantity < actionQuantity) throw "보유 수량이 부족합니다.";

        const newSenderQuantity = itemToSend.quantity - actionQuantity;
        if (newSenderQuantity > 0) {
          senderInventory[selectedItem.name].quantity = newSenderQuantity;
        } else {
          delete senderInventory[selectedItem.name];
        }
        transaction.update(senderRef, { inventory: senderInventory });

        // Recipient logic
        const recipientInventory = recipientDoc.data().inventory || {};
        const currentRecipientQuantity = recipientInventory[selectedItem.name]?.quantity || 0;
        recipientInventory[selectedItem.name] = { 
            itemId: itemToSend.itemId,
            quantity: currentRecipientQuantity + actionQuantity,
            description: selectedItem.details.description,
            sellerId: itemToSend.sellerId,
            sellerNickname: itemToSend.sellerNickname,
            price: itemToSend.price,
        };
        transaction.update(recipientRef, { inventory: recipientInventory });
      });

      toast({ title: '전송 완료', description: `'${selectedItem.name}' ${actionQuantity}개를 성공적으로 보냈습니다.` });
      // Optimistic update
      setUserData(prev => {
        if (!prev || !selectedItem) return prev;
        const newInventory = {...(prev.inventory || {})};
        const newQuantity = (newInventory[selectedItem.name]?.quantity || 0) - actionQuantity;
        if (newQuantity > 0) {
            newInventory[selectedItem.name].quantity = newQuantity;
        } else {
            delete newInventory[selectedItem.name];
        }
        return {...prev, inventory: newInventory};
      });
      closeItemDialogs();

    } catch (error) {
       toast({ variant: "destructive", title: "오류", description: typeof error === 'string' ? error : "아이템 전송 중 오류가 발생했습니다."});
    } finally {
      setIsItemActionLoading(false);
    }
  };

  const handleRefundItem = async () => {
    if (!user || !refundCandidate) return;
    setIsRefundConfirmationOpen(false);
    setIsItemActionLoading(true);

    const { name, details } = refundCandidate;
    const { sellerId, price, itemId } = details;

    if (!sellerId || typeof price !== 'number') {
        toast({ variant: 'destructive', title: '환불 불가', description: '이 상품은 환불할 수 없습니다.' });
        setIsItemActionLoading(false);
        return;
    }

    try {
        await runTransaction(db, async (transaction) => {
            const buyerRef = doc(db, 'users', user.uid);
            const sellerRef = doc(db, 'users', sellerId);
            const itemRef = doc(db, 'class-store-items', itemId);

            const [buyerDoc, sellerDoc, itemDoc] = await Promise.all([
                transaction.get(buyerRef),
                transaction.get(sellerRef),
                transaction.get(itemRef)
            ]);

            if (!buyerDoc.exists()) throw '구매자 정보를 찾을 수 없습니다.';
            if (!sellerDoc.exists()) throw '판매자 정보를 찾을 수 없습니다.';

            const buyerData = buyerDoc.data();
            const buyerInventory = buyerData.inventory || {};

            if (!buyerInventory[name] || buyerInventory[name].quantity < 1) {
                throw '환불할 상품이 없습니다.';
            }

            // 1. Update buyer's inventory
            const newQuantity = buyerInventory[name].quantity - 1;
            if (newQuantity > 0) {
                buyerInventory[name].quantity = newQuantity;
            } else {
                delete buyerInventory[name];
            }
            transaction.update(buyerRef, { inventory: buyerInventory });

            // 2. Refund points to buyer
            transaction.update(buyerRef, { classPoints: increment(price) });

            // 3. Deduct points from seller
            transaction.update(sellerRef, { classPoints: increment(-price) });

            // 4. Update store item quantity
            if (itemDoc.exists()) {
                transaction.update(itemRef, { quantity: increment(1) });
            } else {
                // If item was deleted, re-create it
                const originalItemData = {
                  sellerId: sellerId,
                  sellerName: details.sellerNickname || '', // Should ideally get from seller doc
                  sellerNickname: details.sellerNickname || '',
                  classId: buyerData.classId,
                  name: name,
                  price: price,
                  description: details.description || '',
                  quantity: 1,
                  createdAt: serverTimestamp(),
                }
                transaction.set(itemRef, originalItemData);
            }
        });

        toast({ title: '환불 완료', description: `'${name}' 상품을 환불하고 ${price} 포인트를 돌려받았습니다.` });
        
        setUserData(prev => {
            if (!prev) return null;
            const newInventory = {...prev.inventory};
            if (newInventory[name]) {
                newInventory[name].quantity -= 1;
                if (newInventory[name].quantity <= 0) {
                    delete newInventory[name];
                }
            }
            return {
                ...prev,
                inventory: newInventory,
                classPoints: (prev.classPoints || 0) + price
            };
        });

    } catch (error) {
        toast({ variant: 'destructive', title: '환불 실패', description: typeof error === 'string' ? error : '환불 처리 중 오류가 발생했습니다.' });
    } finally {
        setIsItemActionLoading(false);
        setRefundCandidate(null);
        closeItemDialogs();
    }
};

  const handleOpenSendPointsDialog = useCallback(() => {
    setIsSendPointsDialogOpen(true);
  }, []);

  const handleSendPoints = async () => {
    if (!user || !userData || !sendPointsRecipient || sendPointsAmount <= 0) {
      toast({ variant: 'destructive', title: '오류', description: '받는 사람과 보낼 금액을 확인해주세요.'});
      return;
    }
    if (sendPointsAmount > (userData.classPoints || 0)) {
        toast({ variant: 'destructive', title: '오류', description: '보유한 학급 포인트가 부족합니다.'});
        return;
    }

    setIsSendingPoints(true);
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
        
        // Decrement sender's points
        transaction.update(senderRef, { classPoints: increment(-sendPointsAmount) });
        
        // Increment recipient's points
        transaction.update(recipientRef, { classPoints: increment(sendPointsAmount) });
      });

      const recipientName = classmates.find(c => c.value === sendPointsRecipient)?.label || '친구';
      toast({ title: '전송 완료', description: `${recipientName}님에게 ${sendPointsAmount.toLocaleString()} 포인트를 성공적으로 보냈습니다.` });
      // Optimistic update
      setUserData(prev => prev ? {...prev, classPoints: (prev.classPoints || 0) - sendPointsAmount} : null);
      setIsSendPointsDialogOpen(false);
      setSendPointsAmount(0);
      setSendPointsRecipient('');

    } catch (error) {
      toast({ variant: "destructive", title: "전송 실패", description: typeof error === 'string' ? error : "포인트 전송 중 오류가 발생했습니다."});
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

  const canSendPoints = classmates.length > 0;

  return (
    <>
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
            <div className="flex flex-col items-center">
               <div className="hover:opacity-80">
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
                disabled={!canSendPoints}
                onClick={handleOpenSendPointsDialog}
              >
                포인트 보내기
              </Button>
            </div>
            <div>
              <p className="text-2xl font-bold">{overallAccuracy}%</p>
              <p className="text-sm text-muted-foreground">전체 정답률</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                          className="p-4 text-center cursor-pointer hover:shadow-md hover:border-primary transition flex flex-col"
                          onClick={() => setSelectedItem({ name: itemName, details: itemDetails })}
                        >
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
            <CardTitle className="font-headline flex items-center gap-2">계정 및 학급 설정</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {userData.role === 'teacher' ? (
              <>
                <Button variant="outline" onClick={() => setIsClassCodeDialog(true)}>
                   <Edit className="mr-2 h-4 w-4"/> 학급 코드 관리
                </Button>
                 <Button variant="outline" onClick={() => setIsSendPointsDialogOpen(true)} disabled={!canSendPoints}>
                    <Send className="mr-2 h-4 w-4"/> 학급 포인트 보내기
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
        </CardContent>
      </Card>

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
      
      <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <FileWarning className="text-primary"/> 오답노트
            </CardTitle>
            <CardDescription>
                틀렸던 문제들을 다시 풀어보고 점수를 만회하세요! 복습 효과를 높이기 위해 틀린 문제는 24시간 후에 공개됩니다.
            </CardDescription>
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
                                    <Image src={encodeURI(question.imageUrl)} alt={`질문 ${index + 1} 이미지`} fill className="rounded-md object-contain" unoptimized={true} />
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


      <Card>
        <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
                <Trophy className="text-primary" /> 레벨 엠블럼 컬렉션
            </CardTitle>
            <CardDescription>지금까지 획득한 엠블럼들을 확인해보세요!</CardDescription>
        </CardHeader>
        <CardContent>
            <TooltipProvider delayDuration={0}>
                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-4">
                    {levelSystem.filter(level => userData.xp >= level.xpThreshold).map((level) => (
                        <Tooltip key={level.level}>
                            <TooltipTrigger asChild>
                                <div className={cn(
                                    "group relative aspect-square flex items-center justify-center p-1 rounded-full transition-all duration-300",
                                    'bg-secondary'
                                )}>
                                    <span className={cn(
                                        "text-4xl transition-all duration-300 group-hover:scale-110"
                                    )}>
                                        {level.icon}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="font-semibold">Lv. {level.level}: {level.title}</p>
                                <p className="text-sm text-muted-foreground">필요 XP: {level.xpThreshold.toLocaleString()}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </div>
            </TooltipProvider>
        </CardContent>
      </Card>
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


    {/* Item Management Dialog */}
    <Dialog open={!!selectedItem} onOpenChange={(isOpen) => !isOpen && closeItemDialogs()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{selectedItem?.name}</DialogTitle>
          <DialogDescription>
            {selectedItem?.details.description || "아이템 설명이 없습니다."}
            {selectedItem?.details.price && (
                <div className="text-sm text-primary font-semibold mt-2">
                    구매 가격: {selectedItem.details.price.toLocaleString()} 포인트
                </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
            <Button variant="outline" onClick={() => setItemAction('use')}>
              <MinusCircle className="mr-2 h-4 w-4" />
              사용하기
            </Button>
            <Button variant="outline" onClick={() => setItemAction('send')}>
              <Send className="mr-2 h-4 w-4" />
              보내기
            </Button>
             <Button 
                variant="outline"
                onClick={() => {
                    setRefundCandidate(selectedItem);
                    setIsRefundConfirmationOpen(true);
                    closeItemDialogs();
                }}
                disabled={!selectedItem?.details.sellerId || !selectedItem?.details.price || selectedItem?.details.price === 0}
            >
              <Undo2 className="mr-2 h-4 w-4" />
              환불하기
            </Button>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Refund Confirmation Dialog */}
    <AlertDialog open={isRefundConfirmationOpen} onOpenChange={setIsRefundConfirmationOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>정말 환불하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                    '{refundCandidate?.name}' 상품을 환불합니다. 상품 가격인 {refundCandidate?.details.price?.toLocaleString()} 포인트를 돌려받으며, 상품은 인벤토리에서 사라집니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setRefundCandidate(null)}>취소</AlertDialogCancel>
                <AlertDialogAction onClick={handleRefundItem}>환불</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    
    {/* Item Action Dialog (Use/Send) */}
    <Dialog open={!!itemAction} onOpenChange={(isOpen) => !isOpen && closeItemDialogs()}>
        <DialogContent>
            <DialogHeader>
                 <DialogTitle>
                    {itemAction === 'use' ? '아이템 사용하기' : '아이템 보내기'}
                </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <p><strong>아이템:</strong> {selectedItem?.name}</p>
                <div className="space-y-2">
                    <Label htmlFor="quantity">수량</Label>
                    <Input 
                        id="quantity"
                        type="number"
                        min="1"
                        max={selectedItem?.details.quantity}
                        value={actionQuantity}
                        onChange={(e) => setActionQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                </div>
                {itemAction === 'send' && (
                    <div className="space-y-2">
                        <Label>받는 사람</Label>
                        <Combobox
                          options={classmates}
                          value={sendRecipient}
                          onValueChange={setSendRecipient}
                          placeholder="학급 친구 선택..."
                          searchPlaceholder="이름으로 검색..."
                          notFoundMessage="해당하는 친구가 없습니다."
                        />
                    </div>
                )}
            </div>
            <DialogFooter>
                <Button variant="secondary" onClick={closeItemDialogs}>취소</Button>
                <Button onClick={itemAction === 'use' ? handleUseItem : handleSendItem} disabled={isItemActionLoading}>
                    {isItemActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {itemAction === 'use' ? '사용' : '전송'}
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    
    {/* Send Points Dialog */}
    <Dialog open={isSendPointsDialogOpen} onOpenChange={setIsSendPointsDialogOpen}>
        <DialogContent>
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
                            <Image src={encodeURI(item.question.imageUrl)} alt="질문 이미지" fill className="rounded-md object-contain" unoptimized={true} />
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
    </>
  );
}
