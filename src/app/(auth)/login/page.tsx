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

const formSchema = z.object({
  email: z.string().email({ message: '유효한 이메일을 입력해주세요.' }),
  password: z.string().min(6, { message: '비밀번호는 6자 이상이어야 합니다.' }),
});

export default function LoginPage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    // TODO: Implement Firebase login
  }

  return (
    <>
      <CardHeader className="text-center">
        <CardTitle className="font-headline text-2xl">로그인</CardTitle>
        <CardDescription>계정에 로그인하여 학습 게임을 계속하세요.</CardDescription>
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
                    <Input placeholder="user@example.com" {...field} />
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
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full font-headline">
              로그인
            </Button>
          </form>
        </Form>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">
              또는
            </span>
          </div>
        </div>
        <Button variant="outline" className="w-full">
            <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#4285F4" d="M24 9.5c3.2 0 5.8 1.4 7.6 3.2l5.8-5.8C33.6 2.7 29.2 1 24 1 14.9 1 7.4 6.6 4.1 14.5l6.9 5.3C12.5 13.5 17.8 9.5 24 9.5z"/>
                <path fill="#34A853" d="M46.2 25.4c0-1.8-.2-3.5-.5-5.2H24v9.9h12.5c-.5 3.2-2.3 5.9-5.1 7.8l6.5 5C43.1 38.8 46.2 32.8 46.2 25.4z"/>
                <path fill="#FBBC05" d="M11 20.2c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-6.9-5.3C1.6 8.7 0 13.2 0 18s1.6 9.3 4.1 12.5l6.9-5.3z"/>
                <path fill="#EA4335" d="M24 47c5.2 0 9.6-1.7 12.8-4.6l-6.5-5c-1.8 1.2-4.1 1.9-6.3 1.9-6.2 0-11.5-4-13.4-9.5L4.1 35.5C7.4 43.4 14.9 47 24 47z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Google 계정으로 로그인
        </Button>
      </CardContent>
      <CardFooter className="justify-center text-sm">
        <p>
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </CardFooter>
    </>
  );
}
