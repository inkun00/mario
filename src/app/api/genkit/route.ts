
'use server';

import { ai } from '@/ai';
import '@/ai/flows/quiz-flow'; // Ensure flows are registered
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { flow, input } = await req.json();

  if (!flow) {
    return NextResponse.json({ error: 'Flow not specified' }, { status: 400 });
  }

  try {
    // Use ai.flow() for a more robust resolution of the flow function
    const result = await ai.flow(flow, input);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error(`Error running flow ${flow}:`, e);
    return NextResponse.json(
      { error: `Error running flow: ${e.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
