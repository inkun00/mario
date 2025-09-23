'use server';

import { nextJsHandler } from '@genkit-ai/nextjs/app';
import '@/ai/dev';

export const { GET, POST, OPTIONS } = nextJsHandler();
