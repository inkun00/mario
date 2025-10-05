
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
 * 트랜잭션을 Batched Write로 변경하여 극적으로 경량화된 최종 함수.
 * 디버깅을 위해 상세한 결과 객체를 반환합니다.
 */
export async function finishGameAndRecordStats(
    payload: FinishGamePayload
): Promise<{ success: boolean; message: string; data?: any; error?: any;}> {
    const { gameRoomId, gameSetId, playerUIDs } = payload;
    try {
        const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();

        if (!roomSnap.exists) {
            return { 
                success: false, 
                message: `Game room with ID "${gameRoomId}" not found.`,
                error: { code: 'not-found' },
                data: { gameRoomId }
            };
        }
        
        const gameRoomData = roomSnap.data();
        if (!gameRoomData) {
            return { 
                success: false, 
                message: `Game room data for ID "${gameRoomId}" is empty.`,
                error: { code: 'no-data' },
                data: { gameRoomId }
            };
        }
        
        const finalLogsForXp = gameRoomData.answerLogs || [];
        
        const scores: Record<string, number> = {};
        playerUIDs.forEach(uid => scores[uid] = 0);

        finalLogsForXp.forEach((log: { userId: string, pointsAwarded: number }) => {
            if (log.userId && typeof log.pointsAwarded === 'number' && playerUIDs.includes(log.userId)) {
                scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
            }
        });
        
        if (playerUIDs.length === 0) {
            return { success: true, message: 'No players to update XP for.', data: { receivedData: finalLogsForXp } };
        }
        
        const batch = adminDb.batch();
        const hostId = gameRoomData.hostId;

        for (const uid of playerUIDs) {
            const xpGained = scores[uid] || 0;
            if (xpGained !== 0) {
                const userRef = adminDb.collection('users').doc(uid);
                // Ensure the update call is made by the host on behalf of the server
                // This call will be validated by Firestore rules
                 batch.update(userRef, { xp: FieldValue.increment(xpGained) });
            }

            // Record that the user has played this game set
            const playRecordRef = adminDb.collection('users').doc(uid).collection('playedGameSets').doc(gameSetId);
            batch.set(playRecordRef, {
                gameSetId: gameSetId,
                playedAt: AdminTimestamp.now(),
                gameRoomId: gameRoomId // Pass gameRoomId for rule validation
            });
        }

        await batch.commit();

        return { success: true, message: `Successfully finished game and updated stats for room ${gameRoomId}.` };

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
            data: { gameRoomId, gameSetId, playerUIDs }
        };
    }
}
