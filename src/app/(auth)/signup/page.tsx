'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import Link from 'next/link';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, User } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const formSchema = z.object({
  email: z.string().email({ message: '유효한 이메일을 입력해주세요.' }),
  nickname: z.string().min(2, { message: '닉네임은 2자 이상이어야 합니다.' }).max(20, { message: '닉네임은 20자를 넘을 수 없습니다.' }),
  password: z.string().min(6, { message: '비밀번호는 6자 이상이어야 합니다.' }),
  schoolName: z.string().min(1, '학교 이름을 입력해주세요.'),
});

export default function SignupPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      nickname: '',
      password: '',
      schoolName: '',
    },
  });

  // Function to create user document in Firestore
  const createUserDocument = async (user: User, customData?: { nickname?: string, schoolName?: string }) => {
    const userRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: customData?.nickname || user.displayName,
            schoolName: customData?.schoolName || '',
            createdAt: serverTimestamp(),
            xp: 0,
            level: 1,
        });
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
      const user = userCredential.user;
      await updateProfile(user, {
        displayName: values.nickname
      });
      // Create user document in firestore
      await createUserDocument(user, {
          nickname: values.nickname,
          schoolName: values.schoolName,
      });

      toast({
        title: "회원가입 성공",
        description: "마리오 게임에 오신 것을 환영합니다!",
      });
      router.push('/dashboard');
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "회원가입 실패",
        description: error.message,
      });
    } finally {
        setIsLoading(false);
    }
  }

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="font-headline text-2xl">회원가입</CardTitle>
        <CardDescription>새 계정을 만들어 학습 모험을 시작하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input placeholder="user@example.com" {...field} disabled={isLoading}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>닉네임</FormLabel>
                  <FormControl>
                    <Input placeholder="슈퍼마리오" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="schoolName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>학교 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="마리오초등학교" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full font-headline" disabled={isLoading}>
              {isLoading ? '계정 생성 중...' : '계정 만들기'}
            </Button>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="justify-center text-sm pt-6">
        <p>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </CardFooter>
    </>
  );
}
