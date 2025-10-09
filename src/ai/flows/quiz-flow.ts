'use server';

import { ai } from '@/ai/genkit';
import { QuizSetValidationInputSchema, ValidationOutputSchema } from '@/lib/schemas';
import { z } from 'zod';


export async function validateQuizSet(input: z.infer<typeof QuizSetValidationInputSchema>): Promise<z.infer<typeof ValidationOutputSchema>> {
    return validateQuizSetFlow(input);
}

const QuizValidationPrompt = ai.definePrompt({
    name: 'quizValidationPrompt',
    input: { schema: QuizSetValidationInputSchema },
    output: { schema: ValidationOutputSchema },
    prompt: `당신은 초등학교 교사를 위한 학습 퀴즈 콘텐츠 검수 전문가입니다. 다음 퀴즈 세트가 학생들이 푸는 데 적합한지, 또는 단순히 점수를 얻기 위해 만들어진 무의미한 퀴즈는 아닌지 검토해주세요.

검토 기준:
1.  질문과 정답이 교육적 가치를 가지는가? (예: "1", "ㅇ"과 같이 무의미한 내용으로만 구성되어 있는가?)
2.  질문이 명확하고 이해하기 쉬운가?
3.  질문 안에 답이 직접적으로 노출되거나 쉽게 유추할 수 있지는 않은가?
4.  욕설, 비방 등 부적절한 내용이 포함되어 있지 않은가?

퀴즈 세트 정보:
- 제목: {{{title}}}
- 설명: {{{description}}}
- 학년: {{{grade}}}
- 과목: {{{subject}}}

질문 목록:
{{#each questions}}
- 질문: {{this.question}}, 정답: {{this.answer}}{{this.correctAnswer}}
{{/each}}

위 기준에 따라 퀴즈 세트가 전반적으로 적합하다면 isValid를 true로, 부적합하다면 false로 설정하고 그 이유를 reason에 한국어로 명확하게 작성해주세요. 최소한 하나 이상의 질문이 유의미하고 교육적 가치가 있다면 true로 판단해도 됩니다. 하지만 모든 질문이 숫자나 단순 문자로만 이루어져 있다면 명백히 부적합합니다.`,
});

const validateQuizSetFlow = ai.defineFlow(
    {
        name: 'validateQuizSetFlow',
        inputSchema: QuizSetValidationInputSchema,
        outputSchema: ValidationOutputSchema,
    },
    async (input) => {
        const { output } = await QuizValidationPrompt(input);
        return output!;
    }
);
