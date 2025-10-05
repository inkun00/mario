
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer, FinishGamePayload, Player } from '@/lib/types';
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
 * 게임 종료 시 플레이어들의 점수를 업데이트하고 게임 상태를 변경하는 서버 액션
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
    try {
        const { gameRoomId, gameSetId, playerUIDs } = payload;
        const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
        
        // Use a transaction to read the final scores and update player XPs
        await adminDb.runTransaction(async (transaction) => {
            const roomSnap = await transaction.get(gameRoomRef);
            if (!roomSnap.exists) {
                throw new Error("Game room not found");
            }
            const gameRoom = roomSnap.data();
            if (!gameRoom) {
                throw new Error("Game room data is empty");
            }

            const scores: Record<string, number> = {};
            playerUIDs.forEach(uid => scores[uid] = 0);

            gameRoom.answerLogs?.forEach((log: { userId: string, pointsAwarded: number }) => {
                if (log.userId && typeof log.pointsAwarded === 'number') {
                    scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
                }
            });

            for (const uid of playerUIDs) {
                const userRef = adminDb.collection('users').doc(uid);
                const playedGameSetRef = userRef.collection('playedGameSets').doc(gameSetId);
                const xpGained = scores[uid] || 0;

                if (xpGained !== 0) {
                     transaction.update(userRef, { xp: FieldValue.increment(xpGained), gameRoomId: gameRoomId });
                }
                
                transaction.set(playedGameSetRef, {
                    gameSetId: gameSetId,
                    playedAt: AdminTimestamp.now(),
                    gameRoomId: gameRoomId,
                });
            }
        });
        
        return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };
    } catch (error: any) {
        console.error("Critical error in finishGameAndRecordStats:", error);
        return { success: false, message: `결과 저장 중 오류가 발생했습니다: ${error.message}`, error: error.stack };
    }
}
