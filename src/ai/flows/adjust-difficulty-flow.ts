'use server';

/**
 * @fileOverview An AI agent that dynamically adjusts the game difficulty based on student performance.
 *
 * - adjustDifficulty - A function that adjusts the difficulty of the game.
 * - AdjustDifficultyInput - The input type for the adjustDifficulty function.
 * - AdjustDifficultyOutput - The return type for the adjustDifficulty function.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';

const AdjustDifficultyInputSchema = z.object({
  studentId: z.string().describe('The unique identifier of the student.'),
  gameSetId: z.string().describe('The unique identifier of the game set.'),
  questionId: z.string().describe('The unique identifier of the question.'),
  isCorrect: z.boolean().describe('Whether the student answered the question correctly.'),
  pointsAwarded: z.number().describe('The number of points awarded for the question.'),
  mysteryBoxEnabled: z.boolean().describe('Whether mystery box is enabled for the student.'),
});
export type AdjustDifficultyInput = z.infer<typeof AdjustDifficultyInputSchema>;

const AdjustDifficultyOutputSchema = z.object({
  adjustedPointsAwarded: z
    .number()    
    .describe('The adjusted number of points awarded for the question, based on student performance.'),
  adjustedMysteryBoxEnabled: z
    .boolean()
    .describe('The adjusted status of mystery box, based on student performance.'),
});
export type AdjustDifficultyOutput = z.infer<typeof AdjustDifficultyOutputSchema>;

export async function adjustDifficulty(input: AdjustDifficultyInput): Promise<AdjustDifficultyOutput> {
  return adjustDifficultyFlow(input);
}

const adjustDifficultyPrompt = ai.definePrompt({
  name: 'adjustDifficultyPrompt',
  model: googleAI.model('gemini-1.5-flash'),
  input: {schema: AdjustDifficultyInputSchema},
  output: {schema: AdjustDifficultyOutputSchema},
  prompt: `You are an AI game master, tasked with dynamically adjusting the difficulty of a game for a student.

  Based on the student's performance, you will adjust the points awarded for the next question and whether or not to enable the mystery box feature.

  Student ID: {{{studentId}}}
  Game Set ID: {{{gameSetId}}}
  Question ID: {{{questionId}}}
  Is Correct: {{{isCorrect}}}
  Points Awarded: {{{pointsAwarded}}}
  Mystery Box Enabled: {{{mysteryBoxEnabled}}}

  If the student is performing well (answering correctly and earning points), slightly increase the points awarded for the next question and keep mystery box enabled.
  If the student is struggling (answering incorrectly and not earning points), slightly decrease the points awarded for the next question and consider disabling mystery box to help them focus.

  Return the adjusted points awarded and the adjusted mystery box enabled status.

  Ensure that the adjusted values are reasonable and do not drastically change the game's difficulty.
`,
});

const adjustDifficultyFlow = ai.defineFlow(
  {
    name: 'adjustDifficultyFlow',
    inputSchema: AdjustDifficultyInputSchema,
    outputSchema: AdjustDifficultyOutputSchema,
  },
  async input => {
    const {output} = await adjustDifficultyPrompt(input);
    return output!;
  }
);
