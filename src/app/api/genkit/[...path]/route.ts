'use server';

// All Genkit related initialization and flow imports are handled in this file.
import '@/ai/genkit';

import { nextJsHandler } from '@genkit-ai/next';

export const { GET, POST } = nextJsHandler();
