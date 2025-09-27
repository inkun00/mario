
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { runFlow } from 'genkit';

// Import the centrally configured Genkit instance to ensure all flows are registered
// before any API routes are handled.
import '@/ai';
// Import all the flow files to register them with Genkit.
import '@/ai/flows/quiz-flow';


export async function POST(req: NextRequest) {
  const { flow, input } = await req.json();

  if (!flow) {
    return NextResponse.json({ error: 'Flow not specified' }, { status: 400 });
  }

  try {
    const result = await runFlow(flow, input);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`Error running flow ${flow}:`, e);
    // Return the actual error message from Genkit/Google AI if available
    const errorMessage = e.message || 'Unknown server error';
    const errorDetails = e.cause || {};
    return NextResponse.json(
      { 
        error: `Error running flow: ${errorMessage}`,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}

    
