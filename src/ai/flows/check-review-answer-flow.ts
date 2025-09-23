'use server';

/**
 * @fileOverview An AI agent that checks a user's answer to a review question for semantic correctness.
 *
 * - checkReviewAnswer - Checks if the user's answer is semantically correct.
 * - CheckReviewAnswerInput - The input type for the checkReviewAnswer function.
 * - CheckReviewAnswerOutput - The return type for the checkReviewAnswer function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import type { Question } from '@/lib/types';

const CheckReviewAnswerInputSchema = z.object({
  originalQuestion: z.any().describe("The original question object."),
  reviewQuestion: z.string().describe("The AI-generated review question the user answered."),
  userAnswer: z.string().describe("The user's answer to the review question."),
});
export type CheckReviewAnswerInput = z.infer<typeof CheckReviewAnswerInputSchema>;

const CheckReviewAnswerOutputSchema = z.object({
  isCorrect: z.boolean().describe("Whether the user's answer is semantically correct."),
  explanation: z.string().describe("A brief explanation for why the answer is correct or incorrect."),
});
export type CheckReviewAnswerOutput = z.infer<typeof CheckReviewAnswerOutputSchema>;

export async function checkReviewAnswer(input: { originalQuestion: Question, reviewQuestion: string, userAnswer: string }): Promise<CheckReviewAnswerOutput> {
  return checkReviewAnswerFlow(input);
}


const checkReviewAnswerPrompt = ai.definePrompt({
  name: 'checkReviewAnswerPrompt',
  model: googleAI.model('gemini-1.5-flash'),
  input: { schema: CheckReviewAnswerInputSchema },
  output: { schema: CheckReviewAnswerOutputSchema },
  prompt: `You are an AI grading assistant. Your task is to evaluate a student's answer to a review question.
  The answer doesn't have to be an exact match, but it must be semantically correct.
  Base your evaluation on the context of the original question and its answer.
  Respond in Korean.

  Original Question: {{originalQuestion.question}}
  Correct Answer to Original Question: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}

  Review Question Asked: {{{reviewQuestion}}}
  Student's Answer: {{{userAnswer}}}

  Is the student's answer semantically correct based on the original question's context?
  `,
});

const checkReviewAnswerFlow = ai.defineFlow(
  {
    name: 'checkReviewAnswerFlow',
    inputSchema: CheckReviewAnswerInputSchema,
    outputSchema: CheckReviewAnswerOutputSchema,
  },
  async (input) => {
    const { output } = await checkReviewAnswerPrompt(input);
    return output!;
  }
);
