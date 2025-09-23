/**
 * @fileOverview An AI agent that generates a new review question from a previously incorrect one.
 *
 * - generateReviewQuestion - Creates a new, similar short-answer question.
 * - GenerateReviewQuestionInput - The input type for the generateReviewQuestion function.
 * - GenerateReviewQuestionOutput - The return type for the generateReviewQuestion function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Question } from '@/lib/types';


const GenerateReviewQuestionInputSchema = z.object({
  originalQuestion: z.any().describe("The original question object that the student answered incorrectly."),
});
export type GenerateReviewQuestionInput = z.infer<typeof GenerateReviewQuestionInputSchema>;

const GenerateReviewQuestionOutputSchema = z.object({
  newQuestion: z.string().describe("A new, similar question that is always a short-answer or descriptive question."),
});
export type GenerateReviewQuestionOutput = z.infer<typeof GenerateReviewQuestionOutputSchema>;

export async function generateReviewQuestion(input: { originalQuestion: Question }): Promise<GenerateReviewQuestionOutput> {
  return generateReviewQuestionFlow(input);
}


const generateReviewQuestionPrompt = ai.definePrompt({
  name: 'generateReviewQuestionPrompt',
  input: { schema: GenerateReviewQuestionInputSchema },
  output: { schema: GenerateReviewQuestionOutputSchema },
  prompt: `You are an AI tutor. Your task is to create a review question based on a question a student previously answered incorrectly.
  The new question must be related to the original one but phrased differently.
  It MUST be a subjective/descriptive question that requires a written answer, not multiple choice or O/X.
  Generate only the question text.
  Respond in Korean.

  {{#if originalQuestion.imageUrl}}
  The original question included an image, which is not available now. Therefore, create a new descriptive question based on the original question's correct answer keyword.
  Original Question's Correct Answer: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}
  {{else}}
  Original Question: {{originalQuestion.question}}
  Original Answer: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}
  {{/if}}
  `,
});


const generateReviewQuestionFlow = ai.defineFlow(
  {
    name: 'generateReviewQuestionFlow',
    inputSchema: GenerateReviewQuestionInputSchema,
    outputSchema: GenerateReviewQuestionOutputSchema,
  },
  async (input) => {
    const { output } = await generateReviewQuestionPrompt(input);
    return output!;
  }
);
