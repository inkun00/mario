'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';


/**
 * 오답 노트를 Batched Write를 사용해 효율적으로 기록하는 별도의 함수
 */
async function recordIncorrectAnswers(incorrectLogs: AnswerLog[]) {
    if (incorrectLogs.length === 0) {
        return;
    }

    try {
        const batch = adminDb.batch();

        for (const log of incorrectLogs) {
            if (log.userId && log.question) {
                const incorrectAnswerRef = adminDb.collection('users').doc(log.userId).collection('incorrect-answers').doc(log.id || uuidv4());
                batch.set(incorrectAnswerRef, {
                    id: log.id,
                    userId: log.userId,
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: log.question,
                    userAnswer: log.userAnswer || '',
                    timestamp: log.timestamp,
                });
            }
        }
        await batch.commit();
        console.log(`Successfully recorded ${incorrectLogs.length} incorrect answers.`);
    } catch (error) {
        console.error("Error recording incorrect answers:", error);
        // 이 오류는 사용자에게 직접적인 영향을 주지 않으므로, 에러 로깅만 합니다.
    }
}


/**
 * 1. 게임 종료 및 필수적인 XP 업데이트만 트랜잭션으로 처리합니다.
 * 2. 무거운 오답 노트 기록은 별도 함수로 분리하여 호출합니다.
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalAnswerLogs: Omit<AnswerLog, 'timestamp'> & { timestamp: Date }[]) {
    try {
        const serverAnswerLogs = finalAnswerLogs.map(log => ({
            ...log,
            timestamp: AdminTimestamp.fromDate(new Date(log.timestamp)),
        }));

        // --- 1. 필수적인 XP 업데이트 트랜잭션 ---
        await adminDb.runTransaction(async (transaction) => {
            const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
            const roomSnap = await transaction.get(roomRef);

            if (!roomSnap.exists) {
                throw new Error("Game room not found.");
            }
            
            const playerUIDs = Array.from(new Set(serverAnswerLogs.map(log => log.userId).filter(Boolean))) as string[];
            
            const scores: Record<string, number> = {};
            playerUIDs.forEach(uid => scores[uid] = 0);

            serverAnswerLogs.forEach(log => {
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

        // --- 2. 무거운 오답 노트 기록은 분리하여 비동기 처리 ---
        // 이 작업이 끝날 때까지 기다리지 않으므로 클라이언트는 빠른 응답을 받습니다.
        const incorrectLogs = serverAnswerLogs.filter(log => !log.isCorrect && log.question && ['subjective', 'multipleChoice', 'ox'].includes(log.question.type));
        recordIncorrectAnswers(incorrectLogs as AnswerLog[]);

    } catch (error) {
        console.error("Error in finishGameAndRecordStats:", error);
        throw new Error('Failed to finish game and record stats.');
    }
}
