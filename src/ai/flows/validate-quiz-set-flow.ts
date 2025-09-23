/**
 * @fileOverview An AI agent that validates a user-created quiz set for educational appropriateness.
 *
 * - validateQuizSet - A function that validates the quiz set.
 * - ValidateQuizSetInput - The input type for the validateQuizSet function.
 * - ValidateQuizSetOutput - The return type for the validateQuizSet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const QuestionSchema = z.object({
  question: z.string(),
  answer: z.string().optional(),
  correctAnswer: z.string().optional(),
});

const ValidateQuizSetInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
  questions: z.array(QuestionSchema),
});
export type ValidateQuizSetInput = z.infer<typeof ValidateQuizSetInputSchema>;

const ValidateQuizSetOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the quiz set is valid based on the criteria.'),
  reason: z.string().describe('The reason why the quiz set is invalid. Provide a concise, user-friendly explanation in Korean. If valid, this can be empty.'),
});
export type ValidateQuizSetOutput = z.infer<typeof ValidateQuizSetOutputSchema>;


export async function validateQuizSet(input: ValidateQuizSetInput): Promise<ValidateQuizSetOutput> {
  return validateQuizSetFlow(input);
}


const validateQuizSetPrompt = ai.definePrompt({
  name: 'validateQuizSetPrompt',
  input: { schema: ValidateQuizSetInputSchema },
  output: { schema: ValidateQuizSetOutputSchema },
  prompt: `You are an expert AI content moderator for an educational platform. Your task is to review a user-submitted quiz set to ensure it is appropriate and high-quality.

  Please validate the quiz set based on the following criteria:
  1.  **No Duplicate Questions:** Check if there are any identical or nearly identical questions in the set.
  2.  **Educational and Safe Content:** Ensure all questions and answers are educational, safe for all ages, and not profane, abusive, or designed for cheating/point farming (e.g., "문제1", "정답1").
  3.  **Content Relevance:** Verify that the questions are relevant to the specified grade, subject, and unit. The content should match the provided metadata.

  Here is the quiz set data:
  - Title: {{{title}}}
  - Description: {{{description}}}
  - Grade: {{{grade}}}
  - Semester: {{{semester}}}
  - Subject: {{{subject}}}
  - Unit: {{{unit}}}
  - Questions:
    {{#each questions}}
    - Q: {{this.question}} / A: {{#if this.answer}}{{this.answer}}{{else}}{{this.correctAnswer}}{{/if}}
    {{/each}}

  Based on your review, set \`isValid\` to \`true\` if it meets all criteria.
  If it fails any criterion, set \`isValid\` to \`false\` and provide a clear, concise, user-friendly \`reason\` in Korean explaining what the user needs to fix.
  `,
});

const validateQuizSetFlow = ai.defineFlow(
  {
    name: 'validateQuizSetFlow',
    inputSchema: ValidateQuizSetInputSchema,
    outputSchema: ValidateQuizSetOutputSchema,
  },
  async (input) => {
    const { output } = await validateQuizSetPrompt(input);
    return output!;
  }
);
