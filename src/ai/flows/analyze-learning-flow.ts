'use server';

/**
 * @fileOverview An AI agent that analyzes a student's learning patterns.
 *
 * - analyzeLearning - Analyzes correct and incorrect answers to identify strong and weak areas.
 * - AnalyzeLearningInput - The input type for the analyzeLearning function.
 * - AnalyzeLearningOutput - The return type for the analyzeLearning function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { CorrectAnswer, IncorrectAnswer } from '@/lib/types';

// We define schemas here but will pass raw arrays to the prompt
const CorrectAnswerSchema = z.object({
  gameSetTitle: z.string(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
});
const IncorrectAnswerSchema = z.object({
  gameSetTitle: z.string(),
  question: z.object({
    question: z.string(),
    subject: z.string().optional(),
    unit: z.string().optional(),
  }),
});


const AnalyzeLearningInputSchema = z.object({
  correctAnswers: z.array(CorrectAnswerSchema).describe("A list of questions the student answered correctly."),
  incorrectAnswers: z.array(IncorrectAnswerSchema).describe("A list of questions the student answered incorrectly."),
});
export type AnalyzeLearningInput = z.infer<typeof AnalyzeLearningInputSchema>;


const AnalyzeLearningOutputSchema = z.object({
  strongAreas: z.string().describe("A summary of the student's strong subjects and units based on their correct answers. Provide a concise, bulleted list."),
  weakAreas: z.string().describe("A summary of the student's weak subjects and units based on their incorrect answers. Provide a concise, bulleted list."),
});
export type AnalyzeLearningOutput = z.infer<typeof AnalyzeLearningOutputSchema>;


export async function analyzeLearning(input: {correctAnswers: CorrectAnswer[], incorrectAnswers: IncorrectAnswer[]}): Promise<AnalyzeLearningOutput> {
  // Map data to fit schema for the prompt, Genkit requires this for structured input.
  const mappedInput: AnalyzeLearningInput = {
    correctAnswers: input.correctAnswers.map(a => ({
        gameSetTitle: a.gameSetTitle,
        grade: a.grade,
        semester: a.semester,
        subject: a.subject,
        unit: a.unit,
    })),
    incorrectAnswers: input.incorrectAnswers.map(a => ({
        gameSetTitle: a.gameSetTitle,
        question: {
            question: a.question.question,
            subject: a.question.subject,
            unit: a.question.unit
        }
    }))
  };

  return analyzeLearningFlow(mappedInput);
}

const analyzeLearningPrompt = ai.definePrompt({
  name: 'analyzeLearningPrompt',
  input: { schema: AnalyzeLearningInputSchema },
  output: { schema: AnalyzeLearningOutputSchema },
  prompt: `You are an expert learning analyst AI. Your task is to analyze a student's performance based on their correct and incorrect answers. Identify patterns to determine their strong and weak areas.

  - Analyze the subjects, grades, and units from the lists of correct and incorrect answers.
  - For "strongAreas", summarize which topics the student seems to understand well.
  - For "weakAreas", summarize which topics the student is struggling with.
  - Provide the output as a short, easy-to-read summary for each category. Use bullet points.
  - If a list is empty, state that there is not enough data to analyze.
  - Respond in Korean.

  Correct Answers:
  {{#each correctAnswers}}
  - Subject: {{subject}}, Unit: {{unit}}
  {{/each}}

  Incorrect Answers:
  {{#each incorrectAnswers}}
  - Subject: {{question.subject}}, Unit: {{question.unit}}
  {{/each}}
  `,
});

const analyzeLearningFlow = ai.defineFlow(
  {
    name: 'analyzeLearningFlow',
    inputSchema: AnalyzeLearningInputSchema,
    outputSchema: AnalyzeLearningOutputSchema,
  },
  async (input) => {
    const { output } = await analyzeLearningPrompt(input);
    return output!;
  }
);
