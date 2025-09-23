'use server';

// All Genkit related initialization and flow imports are handled in this file.
import '@/ai/genkit';
import '@/ai/flows/adjust-difficulty-flow';
import '@/ai/flows/analyze-learning-flow';
import '@/ai/flows/check-nickname-flow';
import '@/ai/flows/check-review-answer-flow';
import '@/ai/flows/generate-review-question-flow';
import '@/ai/flows/join-game-flow';
import '@/ai/flows/update-scores-flow';
import '@/ai/flows/validate-quiz-set-flow';

import { nextJsHandler } from '@genkit-ai/next';

export const { GET, POST } = nextJsHandler();
