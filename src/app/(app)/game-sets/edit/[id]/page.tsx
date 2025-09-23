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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import type { GameSet } from '@/lib/types';
import { useAuthState } from 'react-firebase-hooks/auth';

const questionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요.'),
  points: z.coerce.number(),
  type: z.enum(['subjective', 'multipleChoice', 'ox']),
  imageUrl: z.string().url().optional().or(z.literal('')),
  hint: z.string().optional(),
  answer: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
}).refine(data => data.type !== 'subjective' || (data.answer && data.answer.length > 0), {
    message: '주관식 정답을 입력해주세요.',
    path: ['answer'],
}).refine(data => data.type !== 'multipleChoice' || (data.options && data.options.length === 4 && data.options.every(opt => opt && opt.length > 0)), {
    message: '객관식 문제는 4개의 보기를 모두 입력해야 합니다.',
    path: ['options'],
}).refine(data => data.type !== 'multipleChoice' || (data.correctAnswer && data.correctAnswer.length > 0), {
    message: '객관식 문제의 정답을 선택해주세요.',
    path: ['correctAnswer'],
}).refine(data => data.type !== 'ox' || (data.correctAnswer === 'O' || data.correctAnswer === 'X'), {
    message: 'O/X 문제의 정답을 선택해주세요.',
    path: ['correctAnswer'],
});

const gameSetSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().optional(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
  isPublic: z.boolean(),
  questions: z.array(questionSchema).min(5, '최소 5개 이상의 질문이 필요합니다.'),
});

type GameSetFormValues = z.infer<typeof gameSetSchema>;

const defaultQuestion: z.infer<typeof questionSchema> = {
  question: '',
  points: 10,
  type: 'subjective',
  imageUrl: '',
  hint: '',
  answer: '',
  options: ['', '', '', ''],
  correctAnswer: '',
};

const subjects = ['국어', '도덕', '사회', '과학', '수학', '실과', '음악', '미술', '체육', '영어', '창체'];
const pointMapping = [-1, 10, 20, 30, 40, 50];

export default function EditGameSetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const gameSetId = params.id as string;
  const [user, loadingUser] = useAuthState(auth);

  const form = useForm<GameSetFormValues>({
    resolver: zodResolver(gameSetSchema),
    defaultValues: {
      title: '',
      description: '',
      grade: '',
      semester: '',
      subject: '',
      unit: '',
      isPublic: true,
      questions: [],
    },
  });

  useEffect(() => {
    if (!gameSetId) return;

    const fetchGameSet = async () => {
      const docRef = doc(db, "game-sets", gameSetId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const gameSetData = docSnap.data() as GameSet;
        if (user && gameSetData.creatorId !== user.uid) {
            toast({ variant: 'destructive', title: '권한 없음', description: '이 퀴즈 세트를 수정할 권한이 없습니다.' });
            router.push('/dashboard');
            return;
        }
        
        // Ensure optional fields are not undefined
        const dataWithDefaults = {
            ...gameSetData,
            description: gameSetData.description || '',
            grade: gameSetData.grade || '',
            semester: gameSetData.semester || '',
            subject: gameSetData.subject || '',
            unit: gameSetData.unit || '',
            isPublic: gameSetData.isPublic === undefined ? true : gameSetData.isPublic,
            questions: gameSetData.questions.map(q => ({
                ...q,
                imageUrl: q.imageUrl || '',
                hint: q.hint || '',
                answer: q.answer || '',
                options: q.options || ['', '', '', ''],
                correctAnswer: q.correctAnswer || '',
            }))
        };
        form.reset(dataWithDefaults);
      } else {
        toast({ variant: 'destructive', title: '오류', description: '퀴즈 세트를 찾을 수 없습니다.' });
        router.push('/dashboard');
      }
      setIsFetching(false);
    };

    if(user) {
        fetchGameSet();
    }
  }, [gameSetId, form, router, toast, user]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'questions',
  });

  async function onSubmit(data: GameSetFormValues) {
    setIsLoading(true);

    if (!user) {
      toast({ variant: 'destructive', title: '오류', description: '로그인이 필요합니다.' });
      setIsLoading(false);
      return;
    }

    try {
      const gameSetRef = doc(db, 'game-sets', gameSetId);
      // Construct the update object from the form data to prevent issues.
      const updateData = {
        ...data,
        questions: data.questions.map(q => ({
            question: q.question,
            points: q.points,
            type: q.type,
            imageUrl: q.imageUrl || '',
            hint: q.hint || '',
            answer: q.answer || '',
            options: q.options || ['', '', '', ''],
            correctAnswer: q.correctAnswer || '',
        }))
      };

      await updateDoc(gameSetRef, updateData);

      toast({
        title: '성공!',
        description: '퀴즈 세트를 성공적으로 업데이트했습니다.',
      });
      router.push('/dashboard');

    } catch (error) {
      console.error("Error updating game set: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: '퀴즈 세트를 업데이트하는 중 오류가 발생했습니다.',
      });
    } finally {
        setIsLoading(false);
    }
  }

  if (isFetching || loadingUser) {
    return <div className="container mx-auto py-8">퀴즈 세트 정보를 불러오는 중...</div>;
  }
  
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">퀴즈 세트 수정하기</CardTitle>
          <CardDescription>
            퀴즈 세트의 내용을 수정하고 저장하세요.
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
                           <Select onValueChange={field.onChange} value={field.value}>
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
                                  value={field.value}
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
                           <Select onValueChange={field.onChange} value={field.value}>
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

                  <FormField
                        control={form.control}
                        name="isPublic"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>공개 여부</FormLabel>
                                <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => field.onChange(value === 'true')}
                                  value={String(field.value)}
                                  className="flex items-center gap-4 h-10"
                                >
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="true" />
                                    </FormControl>
                                    <FormLabel className="font-normal">공개</FormLabel>
                                  </FormItem>
                                  <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                      <RadioGroupItem value="false" />
                                    </FormControl>
                                    <FormLabel className="font-normal">비공개</FormLabel>
                                  </FormItem>
                                </RadioGroup>
                              </FormControl>
                              <FormDescription>비공개 퀴즈는 나에게만 보입니다.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                        />

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

                         <div className="space-y-4">
                        
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
                            name={`questions.${index}.imageUrl`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>이미지 URL (선택 사항)</FormLabel>
                                <FormControl>
                                    <Input type="url" placeholder="https://example.com/image.png" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />

                            <FormField
                            control={form.control}
                            name={`questions.${index}.hint`}
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>힌트 (선택 사항)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="힌트를 입력하세요." {...field} />
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
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        // Reset other type's answer when switching
                                        if (value === 'subjective') {
                                            form.setValue(`questions.${index}.options`, ['', '', '', '']);
                                            form.setValue(`questions.${index}.correctAnswer`, '');
                                        } else if (value === 'multipleChoice') {
                                            form.setValue(`questions.${index}.answer`, '');
                                        } else { // ox
                                            form.setValue(`questions.${index}.answer`, '');
                                            form.setValue(`questions.${index}.options`, []);
                                        }
                                    }}
                                    value={field.value}
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
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl>
                                        <RadioGroupItem value="ox" />
                                        </FormControl>
                                        <FormLabel className="font-normal">O/X</FormLabel>
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
                                                        <RadioGroupItem value={optionField.value} onClick={() => field.onChange(optionField.value)} />
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

                                {typeValue === 'ox' && (
                                    <FormField
                                        control={form.control}
                                        name={`questions.${index}.correctAnswer`}
                                        render={({ field }) => (
                                        <FormItem className="mt-4">
                                            <FormLabel>정답</FormLabel>
                                            <FormControl>
                                            <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                className="flex items-center gap-4"
                                            >
                                                <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="O" />
                                                </FormControl>
                                                <FormLabel className="font-normal">O</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="X" />
                                                </FormControl>
                                                <FormLabel className="font-normal">X</FormLabel>
                                                </FormItem>
                                            </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    )}
                                </>
                            )}
                            />
                            
                            <div className="grid grid-cols-1 gap-4 pt-2">
                            <FormField
                                control={form.control}
                                name={`questions.${index}.points`}
                                render={({ field }) => (
                                <FormItem>
                                    <div className="flex justify-between">
                                    <FormLabel>획득 점수</FormLabel>
                                    <span className="text-sm font-medium text-primary">
                                        {field.value === -1 ? '랜덤 (10-50점)' : `${field.value}점`}
                                    </span>
                                    </div>
                                    <FormControl>
                                        <Slider
                                            min={0}
                                            max={5}
                                            step={1}
                                            value={[pointMapping.indexOf(field.value)]}
                                            onValueChange={(value) => field.onChange(pointMapping[value[0]])}
                                        />
                                    </FormControl>
                                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                                        <span>랜덤</span>
                                        <span>10</span>
                                        <span>20</span>
                                        <span>30</span>
                                        <span>40</span>
                                        <span>50</span>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            </div>
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

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => router.back()}>취소</Button>
                  <Button type="submit" size="lg" className="font-headline" disabled={isLoading}>
                    {isLoading ? '저장 중...' : '퀴즈 세트 업데이트'}
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
