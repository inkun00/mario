import { z } from 'zod';

// Output Schemas
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


// Input Schemas
export const QuizSetValidationInputSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    grade: z.string().optional(),
    semester: z.string().optional(),
    subject: z.string().optional(),
    unit: z.string().optional(),
    questions: z.array(z.object({
        question: z.string(),
        answer: z.string().optional(),
        correctAnswer: z.string().optional(),
    })),
});

export const LearningAnalysisInputSchema = z.object({
    answerLogs: z.array(z.object({
      question: z.string(),
      isCorrect: z.boolean(),
    })),
});

export const ReviewQuestionInputSchema = z.object({
    question: z.string(),
    answer: z.string(),
    grade: z.string().optional(),
    unit: z.string().optional(),
});

export const CheckReviewAnswerInputSchema = z.object({
    originalQuestion: z.object({
        question: z.string(),
        answer: z.string().optional(),
        correctAnswer: z.string().optional(),
        id: z.number(),
        points: z.number(),
        type: z.enum(['subjective', 'multipleChoice', 'ox']),
        imageUrl: z.string().optional(),
        hint: z.string().optional(),
        options: z.array(z.string()).optional(),
        grade: z.string().optional(),
        semester: z.string().optional(),
        subject: z_string().optional(),
        unit: z.string().optional(),
    }),
    reviewQuestion: z.string(),
    userAnswer: z.string(),
});
