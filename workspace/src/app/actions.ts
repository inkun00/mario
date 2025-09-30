
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
            return;
        }
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(incorrectLog.id || uuidv4());
        await incorrectAnswerRef.set({
            ...rest,
            userId,
            timestamp: AdminTimestamp.fromDate(new Date(incorrectLog.timestamp)), 
        });

    } catch (error) {
        console.error("Error recording single incorrect answer:", error);
    }
}


/**
 * 트랜잭션을 Batched Write로 변경하여 극적으로 경량화된 최종 함수.
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalLogsForXp: { userId: string, pointsAwarded: number }[]) {
    try {
        const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();

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
        
        if (playerUIDs.length === 0) {
            return;
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

        console.log(`Successfully finished game and updated XP for room ${gameRoomId}.`);

    } catch (error) {
        console.error("Error in finishGameAndRecordStats:", error);
        throw new Error('Failed to finish game and record stats.');
    }
}
