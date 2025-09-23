'use server';

import '@/ai/dev';
import { nextJsHandler } from '@genkit-ai/next/app';

export const { GET, POST } = nextJsHandler();
