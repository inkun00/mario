
/**
 * @fileOverview Centralized AI configuration for the application.
 *
 * This file initializes and configures the Genkit AI instance with the necessary plugins,
 * and defines the model to be used.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin, explicitly providing the API key.
// This setup ensures that the API key from environment variables is used for all AI operations.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
});
