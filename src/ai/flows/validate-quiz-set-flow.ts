
'use server';
/**
 * @fileOverview A quiz set validation AI agent.
 *
 * This file contains the Genkit flow for evaluating the educational quality of a quiz set.
 * - evaluateQuizSet - A function that handles the quiz set evaluation process.
 * - QuizSetEvaluationInput - The input type for the evaluateQuizSet function.
 * - QuizSetEvaluationOutput - The return type for the evaluateQuizSet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit/zod';

const QuestionSchema = z.object({
  question: z.string(),
  answer: z.string().optional(),
  correctAnswer: z.string().optional(),
});

export const QuizSetEvaluationInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  grade: z.string(),
  subject: z.string(),
  unit: z.string(),
  questions: z.array(QuestionSchema),
});
export type QuizSetEvaluationInput = z.infer<
  typeof QuizSetEvaluationInputSchema
>;

export const QuizSetEvaluationOutputSchema = z.object({
  score: z
    .number()
    .describe(
      'An overall score from 0 to 100 for the educational quality of the quiz set based on the provided criteria.'
    ),
});
export type QuizSetEvaluationOutput = z.infer<
  typeof QuizSetEvaluationOutputSchema
>;

export async function evaluateQuizSet(
  input: QuizSetEvaluationInput
): Promise<QuizSetEvaluationOutput> {
  const result = await evaluateQuizSetFlow(input);
  return result;
}

const evaluateQuizSetPrompt = ai.definePrompt({
  name: 'evaluateQuizSetPrompt',
  input: { schema: QuizSetEvaluationInputSchema },
  output: { schema: QuizSetEvaluationOutputSchema },
  prompt: `You are an expert in educational content evaluation for elementary school students in South Korea.
Your task is to evaluate the provided quiz set based on the following criteria and provide a single score from 0 to 100.

Evaluation Criteria:
1.  **Appropriateness of Answer (20 points):** Is the provided answer correct and appropriate for the question?
2.  **Level Appropriateness (20 points):** Is the question's difficulty level appropriate for the specified grade level ({{grade}})?
3.  **Educational Significance (20 points):** Is the question's content educationally meaningful and valuable?
4.  **Content Relevance (15 points):** Is the question's content relevant to the specified subject ({{subject}}) and unit ({{unit}})?
5.  **Uniqueness and Intent (15 points):** Does the quiz set contain repetitive or similar questions? Is there any sign that the quiz was made solely for earning points rather than for educational purposes (e.g., extremely easy, nonsensical questions)?
6.  **Completeness and Sincerity (10 points):** Are the questions and answers well-written, without typos, and written with sincerity?

Analyze the entire quiz set below and provide a final score from 0 to 100. Do not provide a breakdown of the score, only the final integer score.

**Quiz Set to Evaluate:**
- **Title:** {{title}}
- **Description:** {{description}}
- **Grade:** {{grade}}
- **Subject:** {{subject}}
- **Unit:** {{unit}}
- **Questions:**
{{#each questions}}
    - **Question:** {{this.question}}
    - **Answer:** {{this.answer}}{{this.correctAnswer}}
{{/each}}
`,
});

const evaluateQuizSetFlow = ai.defineFlow(
  {
    name: 'evaluateQuizSetFlow',
    inputSchema: QuizSetEvaluationInputSchema,
    outputSchema: QuizSetEvaluationOutputSchema,
  },
  async (input) => {
    const { output } = await evaluateQuizSetPrompt(input);
    return output!;
  }
);
