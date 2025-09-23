'use server';

import '@/ai/dev';
import { nextJsHandler } from '@genkit-ai/nextjs/app';

export const { GET, POST } = nextJsHandler();
