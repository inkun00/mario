
/**
 * @fileOverview This file initializes and configures the Genkit AI instance.
 *
 * It sets up the necessary plugins for the application's AI functionalities.
 * Currently, it includes the Google AI plugin for generative models.
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with the Google AI plugin.
// This allows the application to use Google's generative AI models.
export const ai = genkit({
  plugins: [
    googleAI(), // You can configure the API key or other options here if needed.
  ],
});
