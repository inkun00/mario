import { NextRequest, NextResponse } from 'next/server';
import { callGenkitFlow } from '@/lib/flows.server';

export async function POST(req: NextRequest) {
  try {
    const { flow, input } = await req.json();

    if (!flow || typeof flow !== 'string') {
      return NextResponse.json({ error: 'Flow name is required.' }, { status: 400 });
    }

    const result = await callGenkitFlow(flow, input);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('API Route Error:', err);
    return NextResponse.json({ error: err.message || 'An internal server error occurred.' }, { status: 500 });
  }
}
