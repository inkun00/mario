
import { runFlow } from 'genkit';
import { NextRequest, NextResponse } from 'next/server';
import '@/ai';
import '@/ai/flows/quiz-flow';

export async function POST(req: NextRequest) {
  const { flow, input } = await req.json();

  if (!flow) {
    return NextResponse.json({ error: 'Flow ID is required.' }, { status: 400 });
  }

  try {
    const result = await runFlow(flow, input);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`Error running flow ${flow}:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';
    const errorDetails = error.cause ? JSON.stringify(error.cause) : 'No details available.';
    
    return NextResponse.json(
      { 
        error: `Failed to run flow '${flow}'.`,
        details: errorMessage,
        cause: errorDetails
      },
      { status: 500 }
    );
  }
}
