
/**
 * @fileOverview Centralized AI configuration for the application.
 *
 * This file initializes and configures the Genkit AI instance with the necessary plugins.
 * All AI-related flows should be defined in the `src/ai/flows` directory.
 */
import 'dotenv/config';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin.
export const ai = genkit({
  plugins: [
    googleAI({ apiKey: process.env.GEMINI_API_KEY }),
  ],
});
