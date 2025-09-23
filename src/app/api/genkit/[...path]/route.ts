'use server';

import { createApiHandler } from '@genkit-ai/next';
import '@/ai/dev';

export const { GET, POST, OPTIONS } = createApiHandler();
