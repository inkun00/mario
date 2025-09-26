
'use server';

import { NextRequest, NextResponse } from 'next/server';
import {
  validateQuizSetFlow,
  analyzeLearningFlow,
  generateReviewQuestionFlow,
  checkReviewAnswerFlow,
} from '@/ai/flows/quiz-flow';

export async function POST(req: NextRequest) {
  const { flow, input } = await req.json();

  if (!flow) {
    return NextResponse.json({ error: 'Flow not specified' }, { status: 400 });
  }

  try {
    let result;
    switch (flow) {
      case 'validateQuizSet':
        result = await validateQuizSetFlow(input);
        break;
      case 'analyzeLearning':
        result = await analyzeLearningFlow(input);
        break;
      case 'generateReviewQuestion':
        result = await generateReviewQuestionFlow(input);
        break;
      case 'checkReviewAnswer':
        result = await checkReviewAnswerFlow(input);
        break;
      default:
        return NextResponse.json({ error: `Unknown flow: ${flow}` }, { status: 404 });
    }
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
