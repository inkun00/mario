
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer, PlayedGameSet, FinishGamePayload } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: Omit<IncorrectAnswer, 'timestamp'> & { timestamp: Date }) {
    try {
        const { userId, ...rest } = incorrectLog;
        if (!userId) {
            return { success: false, message: "User ID is missing." };
        }
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(incorrectLog.id || uuidv4());
        
        // Convert JS Date to Firestore Timestamp for admin SDK
        await incorrectAnswerRef.set({
            ...rest,
            userId,
            timestamp: AdminTimestamp.fromDate(new Date(incorrectLog.timestamp)), 
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error recording single incorrect answer:", error);
        return { success: false, message: `Failed to record incorrect answer: ${error.message}` };
    }
}


/**
 * 이 함수는 이제 클라이언트 측 로직으로 이동하여 더 이상 사용되지 않습니다.
 * 서버 액션은 오답 기록과 같이 신뢰성이 덜 중요한 가벼운 작업에만 사용됩니다.
 */
export async function finishGameAndRecordStats(
    payload: FinishGamePayload
): Promise<{ success: boolean; message: string; data?: any; error?: any;}> {
    // This server action is deprecated and its logic has been moved to the client-side
    // to properly leverage the Firestore security rules you have defined.
    // It is kept here to avoid breaking imports, but it will not be called.
    console.warn("finishGameAndRecordStats server action is deprecated and should not be called.");
    return {
        success: false,
        message: 'This server action is deprecated. Game finishing logic is now handled on the client.'
    };
}
