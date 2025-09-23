'use server';

import { startFlowsServer } from 'genkit/flow';
import '@/ai/dev';

const flowsServer = startFlowsServer();

export async function GET(request: Request) {
  return flowsServer.handleRequest(request);
}

export async function POST(request: Request) {
  return flowsServer.handleRequest(request);
}
