'use server';

import { config } from 'dotenv';
config();

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Genkit 초기화
genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

// 모든 플로우 파일 import
import '@/ai/flows/adjust-difficulty-flow';
import '@/ai/flows/analyze-learning-flow';
import '@/ai/flows/check-nickname-flow';
import '@/ai/flows/check-review-answer-flow';
import '@/ai/flows/generate-review-question-flow';
import '@/ai/flows/join-game-flow';
import '@/ai/flows/update-scores-flow';
import '@/ai/flows/validate-quiz-set-flow';
