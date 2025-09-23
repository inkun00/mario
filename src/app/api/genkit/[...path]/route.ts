
'use server';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { configureGenkit } from '@genkit-ai/core';

// This is the correct way to initialize Genkit for Next.js API routes.
// It should not be re-declared in other files.
configureGenkit({
  plugins: [googleAI()],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

export const { GET, POST, OPTIONS } = genkit();
