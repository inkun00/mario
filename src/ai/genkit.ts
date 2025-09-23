/**
 * @fileOverview Genkit initialization and plugin configuration.
 *
 * This file is the central point for configuring Genkit in the application.
 * It initializes the Genkit core with necessary plugins and ensures all
 * AI flows are properly imported and registered. This setup is crucial for
 * the Genkit API routes to discover and execute the defined flows.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin.
// This configuration will be used by all flows.
genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

// All flows must be imported here so that they are included in the build
// and discovered by the Genkit API handler.
import '@/ai/flows/adjust-difficulty-flow';
import '@/ai/flows/analyze-learning-flow';
import '@/ai/flows/check-nickname-flow';
import '@/ai/flows/check-review-answer-flow';
import '@/ai/flows/generate-review-question-flow';
import '@/ai/flows/join-game-flow';
import '@/ai/flows/update-scores-flow';
import '@/ai/flows/validate-quiz-set-flow';
