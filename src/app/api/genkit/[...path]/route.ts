import { ai } from '@/ai/genkit';
import createNextApiHandler from '@genkit-ai/next';

export const GET = createNextApiHandler(ai);
export const POST = createNextApiHandler(
  ai,
  { cors: { origin: '*' } }
);
export const OPTIONS = createNextApiHandler(
  ai,
  { cors: { origin: '*' } }
);
