'use server';

import { getGafHandler } from 'genkit/gaf';
import '@/ai/dev';

export const { GET, POST, OPTIONS } = getGafHandler();
