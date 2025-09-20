'use client';

import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const questionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요.'),
  points: z.coerce.number().min(1).max(5),
  hasMysteryBox: z.boolean().default(false),
  type: z.enum(['subjective', 'multipleChoice']),
  answer: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
}).refine(data => {
  if (data.type === 'multipleChoice') {
    return data.options && data.options.length === 4 && data.options.every(opt => opt.length > 0) && data.correctAnswer;
  }
  if (data.type === 'subjective') {
    return data.answer && data.answer.length > 0;
  }
  return true;
}, {
    message: '객관식 문제는 4개의 보기를 모두 입력하고 정답을 선택해야 합니다. 주관식 문제는 정답을 입력해야 합니다.',
    path: ['correctAnswer'],
});

const gameSetSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().optional(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
  questions: z.array(questionSchema).min(1, '최소 1개 이상의 질문이 필요합니다.'),
});

type GameSetFormValues = z.infer<typeof gameSetSchema>;

const defaultQuestion: z.infer<typeof questionSchema> = {
  question: '',
  points: 3,
  hasMysteryBox: false,
  type: 'subjective',
  answer: '',
  options: ['', '', '', ''],
  correctAnswer: '',
};

const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];

export default function CreateGameSetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const form = useForm<GameSetFormValues>({
    resolver: zodResolver(gameSetSchema),
    defaultValues: {
      title: '',
      description: '',
      questions: [defaultQuestion],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'questions',
  });

  async function onSubmit(data: GameSetFormValues) {
    setIsLoading(true);
    const user = auth.currentUser;

    if (!user) {
      toast({
        variant: 'destructive',
        title: '오류',
        description: '로그인이 필요합니다.',
      });
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'game-sets'), {
        ...data,
        creatorId: user.uid,
        creatorNickname: user.displayName || '이름없음',
        createdAt: serverTimestamp(),
      });

      toast({
        title: '성공!',
        description: '새로운 퀴즈 세트를 성공적으로 만들었습니다.',
      });
      router.push('/dashboard');

    } catch (error) {
      console.error("Error creating game set: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '퀴즈 세트를 만드는 중 오류가 발생했습니다.',
      });
    } finally {
        setIsLoading(false);
    }
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">새로운 퀴즈 세트 만들기</CardTitle>
          <CardDescription>
            다른 사람들과 플레이할 나만의 학습 퀴즈 세트를 만들어보세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <fieldset disabled={isLoading} className="space-y-8">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-semibold">제목</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="예: 5학년 2학기 사회 퀴즈"
                            {...field}
                            className="text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-lg font-semibold">설명</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="퀴즈 세트에 대한 간단한 설명을 입력하세요."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="grade"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>학년</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="학년 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Array.from({ length: 6 }, (_, i) => i + 1).map(grade => (
                                <SelectItem key={grade} value={`${grade}학년`}>{grade}학년</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={form.control}
                        name="semester"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>학기</FormLabel>
                                <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="flex items-center gap-4 h-10"
                                >
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="1학기" />
                                    </FormControl>
                                    <FormLabel className="font-normal">1학기</FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="2학기" />
                                    </FormControl>
                                    <FormLabel className="font-normal">2학기</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                    <FormField
                      control={form.control}
                      name="subject"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>과목</FormLabel>
                           <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="과목 선택" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {subjects.map(subject => (
                                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={form.control}
                        name="unit"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>단원</FormLabel>
                            <FormControl>
                            <Input placeholder="예: 1. 우리 지역의 자연환경" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h3 className="text-lg font-semibold mb-4">질문 카드</h3>
                  <div className="space-y-6">
                    {fields.map((field, index) => (
                      <Card key={field.id} className="p-4 bg-secondary/30">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-semibold">질문 {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <FormField
                          control={form.control}
                          name={`questions.${index}.question`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>문제</FormLabel>
                              <FormControl>
                                <Textarea placeholder="문제를 입력하세요." {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`questions.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="mt-4">
                              <FormLabel>유형</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  onValueChange={field.onChange}
                                  defaultValue={field.value}
                                  className="flex items-center gap-4"
                                >
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="subjective" />
                                    </FormControl>
                                    <FormLabel className="font-normal">주관식</FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="multipleChoice" />
                                    </FormControl>
                                    <FormLabel className="font-normal">객관식</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <Controller
                          control={form.control}
                          name={`questions.${index}.type`}
                          render={({ field: { value: typeValue } }) => (
                            <>
                              {typeValue === 'subjective' && (
                                <FormField
                                  control={form.control}
                                  name={`questions.${index}.answer`}
                                  render={({ field }) => (
                                    <FormItem className="mt-4">
                                      <FormLabel>정답</FormLabel>
                                      <FormControl>
                                        <Input placeholder="주관식 정답을 입력하세요." {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}

                              {typeValue === 'multipleChoice' && (
                                <div className="mt-4 space-y-4">
                                  <FormLabel>보기 및 정답</FormLabel>
                                  <FormField
                                    control={form.control}
                                    name={`questions.${index}.correctAnswer`}
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormControl>
                                          <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="space-y-2"
                                          >
                                            {Array.from({ length: 4 }).map((_, optIndex) => (
                                              <FormField
                                                key={`${field.name}-option-${optIndex}`}
                                                control={form.control}
                                                name={`questions.${index}.options.${optIndex}`}
                                                render={({ field: optionField }) => (
                                                  <FormItem className="flex items-center gap-2">
                                                    <FormControl>
                                                      <RadioGroupItem value={optionField.value} />
                                                    </FormControl>
                                                    <Input placeholder={`보기 ${optIndex + 1}`} {...optionField} />
                                                  </FormItem>
                                                )}
                                              />
                                            ))}
                                          </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        />
                        
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <FormField
                            control={form.control}
                            name={`questions.${index}.points`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>획득 점수 (1-5)</FormLabel>
                                <FormControl>
                                  <Input type="number" min="1" max="5" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`questions.${index}.hasMysteryBox`}
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>특수 효과</FormLabel>
                                  <div className="flex items-center space-x-2 h-10">
                                      <FormControl>
                                          <Switch
                                          checked={field.value}
                                          onCheckedChange={field.onChange}
                                          />
                                      </FormControl>
                                      <Label htmlFor="mystery-box">미스터리 박스</Label>
                                  </div>
                              </FormItem>
                            )}
                          />
                        </div>
                      </Card>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-6"
                    onClick={() => append(defaultQuestion)}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    질문 추가
                  </Button>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" size="lg" className="font-headline" disabled={isLoading}>
                    {isLoading ? '저장 중...' : '퀴즈 세트 저장'}
                  </Button>
                </div>
              </fieldset>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
