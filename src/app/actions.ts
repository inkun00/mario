
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer } from '@/lib/types';
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
 * 트랜잭션을 Batched Write로 변경하여 극적으로 경량화된 최종 함수.
 * 디버깅을 위해 상세한 결과 객체를 반환합니다.
 */
export async function finishGameAndRecordStats(
    gameRoomId: string,
    finalLogsForXp: { userId: string, pointsAwarded: number }[],
    options?: { skipXpUpdate?: boolean }
): Promise<{ success: boolean; message: string; data?: any; error?: any;}> {
    try {
        const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();

        if (!roomSnap.exists) {
            // Return a structured error if the game room is not found.
            return { 
                success: false, 
                message: `Game room with ID "${gameRoomId}" not found.`,
                error: { code: 'not-found' },
                data: { gameRoomId }
            };
        }
        
        const playerUIDs = Array.from(new Set(finalLogsForXp.map(log => log.userId).filter(uid => uid && typeof uid === 'string')));
        
        if (options?.skipXpUpdate) {
            return {
                success: true,
                message: `Game ${gameRoomId} finished. XP updates were skipped.`,
                data: { receivedData: finalLogsForXp }
            };
        }

        const scores: Record<string, number> = {};
        playerUIDs.forEach(uid => scores[uid] = 0);

        finalLogsForXp.forEach(log => {
            if (log.userId && typeof log.pointsAwarded === 'number') {
                scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
            }
        });
        
        if (playerUIDs.length === 0) {
            return { success: true, message: 'No players to update XP for.', data: { receivedData: finalLogsForXp } };
        }
        
        const batch = adminDb.batch();

        playerUIDs.forEach(uid => {
            const xpGained = scores[uid] || 0;
            if (xpGained !== 0) {
                const userRef = adminDb.collection('users').doc(uid);
                batch.update(userRef, { xp: FieldValue.increment(xpGained) });
            }
        });

        await batch.commit();

        return { success: true, message: `Successfully finished game and updated XP for room ${gameRoomId}.` };

    } catch (error: any) {
        console.error("Error in finishGameAndRecordStats:", error);
        return { 
            success: false, 
            message: error.message || 'An unknown error occurred on the server.',
            error: {
                message: error.message,
                stack: error.stack,
                code: error.code,
            },
            data: { gameRoomId, receivedData: finalLogsForXp }
        };
    }
}
