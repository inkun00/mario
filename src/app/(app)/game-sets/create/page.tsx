
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
import { PlusCircle, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const questionSchema = z.object({
  question: z.string().min(1, '질문을 입력해주세요.'),
  points: z.coerce.number(),
  type: z.enum(['subjective', 'multipleChoice', 'ox']),
  imageUrl: z.string().url().optional().or(z.literal('')),
  hint: z.string().optional(),
  answer: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
}).refine(data => {
    if (data.type === 'subjective') {
        return data.answer && data.answer.length > 0;
    }
    return true;
}, {
    message: '주관식 정답을 입력해주세요.',
    path: ['answer'],
}).refine(data => {
    if (data.type === 'multipleChoice') {
        return data.options && data.options.length === 4 && data.options.every(opt => opt && opt.length > 0);
    }
    return true;
}, {
    message: '객관식 문제는 4개의 보기를 모두 입력해야 합니다.',
    path: ['options'],
}).refine(data => {
    if (data.type === 'multipleChoice') {
        return data.correctAnswer && data.correctAnswer.length > 0;
    }
    return true;
}, {
    message: '객관식 문제의 정답을 선택해주세요.',
    path: ['correctAnswer'],
}).refine(data => {
    if (data.type === 'ox') {
        return data.correctAnswer === 'O' || data.correctAnswer === 'X';
    }
    return true;
}, {
    message: 'O/X 문제의 정답을 선택해주세요.',
    path: ['correctAnswer'],
});


const gameSetSchema = z.object({
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().optional(),
  grade: z.string().min(1, '학년을 선택해주세요.'),
  semester: z.string().optional(),
  subject: z.string().min(1, '과목을 선택해주세요.'),
  unit: z.string().min(1, '단원을 입력해주세요.'),
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

async function callApi(flowName: string, input: any) {
  const response = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flowName, input }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || 'API call failed');
  }
  return response.json();
}

export default function CreateGameSetPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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
      questions: [
        { ...defaultQuestion },
      ],
    },
     mode: "onChange",
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
      const validationResult = await callApi('validateQuizSet', data);
      if (!validationResult.isValid) {
        toast({
          variant: 'destructive',
          title: '퀴즈 세트 저장 실패',
          description: validationResult.reason || 'AI 검증에 실패했습니다. 내용을 다시 확인해주세요.',
        });
        setIsLoading(false);
        return;
      }

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

    } catch (error: any) {
      console.error("Error creating game set: ", error);
      toast({
        variant: 'destructive',
        title: '오류',
        description: `퀴즈 세트를 만드는 중 오류가 발생했습니다: ${error.message}`,
      });
    } finally {
        setIsLoading(false);
    }
  }
  
  const { isValid, errors } = form.formState;
  
  const submitButton = (
    <Button type="submit" size="lg" className="font-headline w-full" disabled={isLoading || !isValid}>
      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> AI 검증 및 저장 중...</> : <><Sparkles className="mr-2 h-4 w-4" /> 퀴즈 세트 저장</>}
    </Button>
  );

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-2xl">새로운 퀴즈 세트 만들기</CardTitle>
          <CardDescription>
            다른 사람들과 플레이할 나만의 학습 퀴즈 세트를 만들어보세요.
          </CardDescription>
          <p className="text-sm text-destructive mt-2">5개 이상의 문제를 만들어야 저장할 수 있습니다.</p>
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

                   <FormField
                        control={form.control}
                        name="isPublic"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>공개 여부</FormLabel>
                                <FormControl>
                                <RadioGroup
                                  onValueChange={(value) => field.onChange(value === 'true')}
                                  defaultValue={String(field.value)}
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
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">질문 카드</h3>
                    <FormField
                      control={form.control}
                      name="questions"
                      render={() => <FormMessage />}
                    />
                  </div>
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

                <div className="flex flex-col sm:flex-row justify-end items-center gap-4">
                  <p className="text-xs text-destructive-foreground bg-destructive/80 p-2 rounded-md">
                    주의: 부정한 방법으로 점수를 올리기 위해 퀴즈를 생성하는 경우 계정이 삭제될 수 있습니다.
                  </p>
                  <div className="w-full sm:w-auto flex flex-col items-center">
                    {isValid ? (
                      submitButton
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span tabIndex={0} className="w-full">
                              {submitButton}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {errors.questions
                                ? '최소 5개 이상의 질문이 필요합니다.'
                                : '모든 필수 항목을 입력해주세요.'}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </fieldset>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
