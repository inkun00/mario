import { NextRequest, NextResponse } from 'next/server';
import { validateQuizSet } from '@/ai/flows/quiz-flow';
import { QuizSetValidationInputSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  const body = await req.json();

  const parseResult = QuizSetValidationInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await validateQuizSet(parseResult.data);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI validation error:', error);
    return NextResponse.json(
      { error: 'AI validation failed', details: error.message },
      { status: 500 }
    );
  }
}
