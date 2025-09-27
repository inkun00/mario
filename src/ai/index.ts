
/**
 * @fileOverview Centralized AI configuration for the application.
 *
 * This file initializes and configures the Genkit AI instance with the necessary plugins,
 * defines the model to be used, and imports all AI flows to ensure they are registered.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

// Initialize Genkit with the Google AI plugin, explicitly providing the API key.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GEMINI_API_KEY,
    }),
  ],
});

// Define the model to be used throughout the application.
export const geminiPro = googleAI.model('gemini-pro');
    
