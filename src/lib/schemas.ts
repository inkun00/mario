import { z } from 'zod';

export const ValidationOutputSchema = z.object({
  isValid: z.boolean(),
  reason: z.string().optional(),
});

export const AnalysisOutputSchema = z.object({
  strongAreas: z.string(),
  weakAreas: z.string(),
});

export const ReviewQuestionOutputSchema = z.object({
  newQuestion: z.string(),
});

export const CheckReviewAnswerOutputSchema = z.object({
  isCorrect: z.boolean(),
  explanation: z.string(),
});
