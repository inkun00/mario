'use server';

/**
 * @fileOverview Genkit initialization and plugin configuration.
 *
 * This file is the central point for configuring Genkit in the application.
 * It initializes the Genkit core with necessary plugins. The exported `ai`
 * object is used by all flows to define prompts, flows, and other Genkit assets.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Configure Genkit with the Google AI plugin.
// This configuration will be used by all flows.
export const ai = genkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
