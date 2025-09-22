'use server';

import { defineGenkit } from '@genkit-ai/next';
import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

import '@/ai/flows/adjust-difficulty-flow.ts';
import '@/ai/flows/check-nickname-flow.ts';
import '@/ai/flows/analyze-learning-flow.ts';
import '@/ai/flows/generate-review-question-flow.ts';
import '@/ai/flows/check-review-answer-flow.ts';
import '@/ai/flows/update-scores-flow.ts';
import '@/ai/flows/validate-quiz-set-flow.ts';

export const { GET, POST, OPTIONS } = defineGenkit({
  plugins: [googleAI()],
  flow: [],
  model: 'googleai/gemini-2.5-flash',
});
