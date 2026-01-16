'use client';

import { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, School, Users, Crown, Store } from 'lucide-react';
import Link from 'next/link';
import { PixelAvatar } from '@/components/pixel-avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function MyClassPage() {
  const [user, loadingUser] = useAuthState(auth);
  const [userData, setUserData] = useState<User | null>(null);
  const [teacher, setTeacher] = useState<User | null>(null);
  const [classmates, setClassmates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    const targetClassId = userData.role === 'teacher' ? userData.uid : userData.classId;

    if (!targetClassId) {
      setIsLoading(false);
      return;
    }

    // Fetch teacher data
    const teacherId = userData.role === 'teacher' ? userData.uid : userData.classId;
    if (teacherId) {
      const unsubTeacher = onSnapshot(doc(db, 'users', teacherId), (doc) => {
        if (doc.exists()) {
          setTeacher(doc.data() as User);
        }
      });
      
      // Fetch classmates data
      const classmatesQuery = query(collection(db, 'users'), where('classId', '==', targetClassId));
      const unsubClassmates = onSnapshot(classmatesQuery, (snapshot) => {
        const members = snapshot.docs.map(doc => doc.data() as User);
        setClassmates(members.filter(m => m.uid !== teacherId));
        setIsLoading(false);
      });

      return () => {
        unsubTeacher();
        unsubClassmates();
      };
    } else {
        setIsLoading(false);
    }
  }, [userData]);

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
                        아직 소속된 학급이 없습니다. 마이페이지에서 학급 코드를 입력하여 학급에 참여하세요.
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
        {teacher && (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                         <Avatar className="h-16 w-16">
                           <PixelAvatar pixels={teacher.pixelAvatar ? JSON.parse(teacher.pixelAvatar) : null} />
                         </Avatar>
                        <div>
                            <CardTitle className="font-headline text-2xl flex items-center gap-2">
                                <Crown className="w-6 h-6 text-yellow-500"/>
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
                    <Users className="w-6 h-6 text-primary"/>
                    우리 학급 친구들
                </CardTitle>
                <CardDescription>총 {classmates.length}명의 친구들이 함께하고 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
                {classmates.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {classmates.map(member => {
                            let pixelAvatarData = null;
                            if (member.pixelAvatar) {
                                try { pixelAvatarData = JSON.parse(member.pixelAvatar); } catch(e) {}
                            }
                            return (
                                <div key={member.uid} className="flex flex-col items-center gap-2 text-center">
                                    <Avatar className="h-20 w-20">
                                        <PixelAvatar pixels={pixelAvatarData} />
                                    </Avatar>
                                    <p className="font-medium text-sm truncate w-full">{member.displayName}</p>
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
                    <Store className="w-6 h-6 text-primary"/>
                    학급 매점
                </CardTitle>
                <CardDescription>학급 친구들이 판매하는 아이템을 구매하거나, 내 아이템을 판매할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button asChild>
                    <Link href="/class-store">매점으로 이동하기</Link>
                </Button>
            </CardContent>
        </Card>
    </div>
  );
}
