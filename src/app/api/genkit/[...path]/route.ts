import createNextApiHandler from '@genkit-ai/next';

const handler = createNextApiHandler();

export { handler as GET, handler as POST, handler as OPTIONS };
