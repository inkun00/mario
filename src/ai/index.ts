/**
 * @fileOverview Centralized AI configuration for the application.
 *
 * This file initializes and configures the Genkit AI instance with the necessary plugins.
 * All AI-related flows should be defined in the `src/ai/flows` directory.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin.
// It will automatically look for the GEMINI_API_KEY (or NEXT_PUBLIC_GEMINI_API_KEY) in the environment variables.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
