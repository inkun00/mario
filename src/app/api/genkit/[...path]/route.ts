'use server';

import runFlow from '@genkit-ai/next';
import { NextRequest, NextResponse } from 'next/server';

async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'POST, OPTIONS' },
    });
  }

  const { flowId, input } = await req.json();

  if (!flowId) {
    return NextResponse.json(
      { error: 'flowId is required' },
      { status: 400 }
    );
  }

  try {
    const result = await runFlow(flowId, input);
    return NextResponse.json(result, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || 'An unexpected error occurred' },
      { 
        status: 500,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-control-allow-headers': 'Content-Type, Authorization',
        }
    });
}

export { handler as POST, handler as GET };
