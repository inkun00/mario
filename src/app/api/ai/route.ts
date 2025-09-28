
'use server';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'AI features are currently disabled.' },
    { status: 503 }
  );
}

    