
import { NextRequest, NextResponse } from 'next/server';
import {
  validateQuizSet,
  analyzeLearning,
  generateReviewQuestion,
  checkReviewAnswer,
} from '@/ai/flows/quiz-flow';

const flows = {
  validateQuizSet,
  analyzeLearning,
  generateReviewQuestion,
  checkReviewAnswer,
};

type FlowName = keyof typeof flows;

const isFlowName = (name: string): name is FlowName => {
  return name in flows;
};

export async function POST(req: NextRequest) {
  try {
    const { flowName, input } = await req.json();

    if (!flowName || !isFlowName(flowName)) {
      return NextResponse.json(
        { error: 'A valid flow name is required.' },
        { status: 400 }
      );
    }
    
    if (!input) {
      return NextResponse.json(
        { error: 'Input data is required.'},
        { status: 400 }
      );
    }

    const flowFunction = flows[flowName];
    const result = await (flowFunction as (arg: any) => Promise<any>)(input);
    
    return NextResponse.json(result, { status: 200 });

  } catch (error: any) {
    console.error(`Error running flow:`, error);
    const errorMessage = error.message || 'An unexpected error occurred.';

    return NextResponse.json(
      {
        error: 'Failed to run AI flow.',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
