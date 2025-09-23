'use server';

import '@/ai/genkit';
import { nextJsHandler } from '@genkit-ai/next/app';

// All flows must be imported here so that they are included in the build.
import '@/ai/flows/adjust-difficulty-flow';
import '@/ai/flows/analyze-learning-flow';
import '@/ai/flows/check-nickname-flow';
import '@/ai/flows/check-review-answer-flow';
import '@/ai/flows/generate-review-question-flow';
import '@/ai/flows/join-game-flow';
import '@/ai/flows/update-scores-flow';
import '@/ai/flows/validate-quiz-set-flow';


export const { GET, POST } = nextJsHandler();
