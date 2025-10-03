
'use server';

import { NextRequest, NextResponse } from 'next/server';

/**
 * Handles POST requests to the AI endpoint.
 * Currently, all AI features are disabled.
 * This function returns a 503 Service Unavailable response.
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { success: false, error: 'AI features are currently disabled.' },
    { status: 503 }
  );
}
