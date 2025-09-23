'use server';

import { config } from 'dotenv';
config();

import '@/ai/flows/join-game-flow.ts';
import '@/ai/flows/adjust-difficulty-flow.ts';
import '@/ai/flows/check-nickname-flow.ts';
import '@/ai/flows/analyze-learning-flow.ts';
import '@/ai/flows/generate-review-question-flow.ts';
import '@/ai/flows/check-review-answer-flow.ts';
import '@/ai_flows/update-scores-flow.ts';
import '@/ai/flows/validate-quiz-set-flow.ts';

    