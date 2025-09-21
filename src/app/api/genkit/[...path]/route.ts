import { genkit } from '@/ai/genkit';
import { createNextApiHandler } from '@genkit-ai/next';

export const GET = createNextApiHandler(genkit);
export const POST = createNextApiHandler(
  genkit,
  { cors: { origin: '*' } }
);
export const OPTIONS = createNextApiHandler(
  genkit,
  { cors: { origin: '*' } }
);
