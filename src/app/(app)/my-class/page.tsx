'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Crown, Store, ShoppingCart, Repeat } from 'lucide-react';
import { getLevelInfo } from '@/lib/level-system';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function MyClassPage() {
  const [user] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [classMembers, setClassMembers] = useState<User[]>([]);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchClassData = async () => {
      setIsLoading(true);

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const currentUserData = userSnap.data() as User;
        setUserData(currentUserData);

        let members: User[] = [];
        // If the user is a teacher
        if (currentUserData.role === 'teacher') {
          const q = query(collection(db, 'users'), where('classId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          members = querySnapshot.docs.map(doc => doc.data() as User);
          setTeacher(currentUserData);
        } 
        // If the user is a student and has a classId
        else if (currentUserData.role === 'student' && currentUserData.classId) {
          const teacherRef = doc(db, 'users', currentUserData.classId);
          const teacherSnap = await getDoc(teacherRef);
          if (teacherSnap.exists()) {
            setTeacher(teacherSnap.data() as User);
          }

          const q = query(collection(db, 'users'), where('classId', '==', currentUserData.classId));
          const querySnapshot = await getDocs(q);
          members = querySnapshot.docs.map(doc => doc.data() as User);
        }
        
        setClassMembers(members.sort((a, b) => b.xp - a.xp));
      }

      setIsLoading(false);
    };

    fetchClassData();
  }, [user]);

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
                        <CardTitle className="flex items-center gap-2"><Store className="text-primary"/>학급 매점</CardTitle>
                        <CardDescription>학급 포인트를 사용하여 다양한 아이템을 구매하거나 판매할 수 있습니다. (개발 중)</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4">
                        <Button className="w-full" disabled>
                            <ShoppingCart className="mr-2 h-4 w-4"/> 물건 사기
                        </Button>
                        <Button className="w-full" variant="secondary" disabled>
                            <Repeat className="mr-2 h-4 w-4"/> 물건 팔기
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
