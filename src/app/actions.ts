
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { FinishGamePayload, IncorrectAnswer, AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';


/**
 * 게임 종료 시 플레이어들의 게임 참여 기록, 경험치, 과목/단원별 통계를 업데이트하는 서버 액션
 * @deprecated This function is deprecated and moved to client-side due to server authentication issues.
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
  // This server action is no longer in use. The logic has been moved to the client-side
  // in `src/app/(app)/game/[id]/page.tsx`'s `handleFinishAndSave` function to bypass
  // persistent server-side Firebase Admin SDK authentication errors.
  throw new Error("This server action is deprecated.");
}
