'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { AnswerLog, IncorrectAnswer } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: Omit<IncorrectAnswer, 'timestamp'> & { timestamp: Date }) {
    try {
        const { userId, ...rest } = incorrectLog;
        if (!userId) {
            // userId가 없는 경우 그냥 무시
            return;
        }

        const logWithAdminTimestamp = {
            ...rest,
            userId,
            timestamp: AdminTimestamp.fromDate(new Date(incorrectLog.timestamp)),
        };
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(logWithAdminTimestamp.id || uuidv4());
        await incorrectAnswerRef.set(logWithAdminTimestamp);

    } catch (error) {
        console.error("Error recording single incorrect answer:", error);
        // 이 오류는 사용자에게 직접적인 영향을 주지 않으므로, 에러를 던지지 않고 로깅만 합니다.
    }
}


/**
 * 게임 종료 시 필수적인 XP 업데이트만 트랜잭션으로 처리하는 경량화된 함수
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalLogsForXp: { userId: string, pointsAwarded: number }[]) {
    try {
        // --- 1. 필수적인 XP 업데이트 트랜잭션 ---
        await adminDb.runTransaction(async (transaction) => {
            const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
            const roomSnap = await transaction.get(roomRef);

            if (!roomSnap.exists) {
                throw new Error("Game room not found.");
            }
            
            const playerUIDs = Array.from(new Set(finalLogsForXp.map(log => log.userId).filter(Boolean))) as string[];
            
            const scores: Record<string, number> = {};
            playerUIDs.forEach(uid => scores[uid] = 0);

            finalLogsForXp.forEach(log => {
                if (log.userId && typeof log.pointsAwarded === 'number') {
                    scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
                }
            });
            
            const userRefs = playerUIDs.map(uid => adminDb.collection('users').doc(uid));
            const userSnaps = await transaction.getAll(...userRefs);
            
            userSnaps.forEach(userSnap => {
                if (userSnap.exists) {
                    const userRef = userSnap.ref;
                    const xpGained = scores[userSnap.id] || 0;
                    
                    if (xpGained !== 0) {
                        transaction.update(userRef, { xp: FieldValue.increment(xpGained) });
                    }
                }
            });
        });

        console.log(`Successfully finished game and updated XP for room ${gameRoomId}.`);

    } catch (error) {
        console.error("Error in finishGameAndRecordStats:", error);
        throw new Error('Failed to finish game and record stats.');
    }
}
