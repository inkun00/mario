import createNextApiHandler from '@genkit-ai/next';

const handler = createNextApiHandler({
  cors: { origin: '*' },
});

export { handler as GET, handler as POST, handler as OPTIONS };
