'use server';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import type { User, AnswerLog, Question } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin SDK. This must be done once per server instance.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();


/**
 * Finishes the game and records stats for all players.
 * This function is designed to be called when the game ends.
 * It uses a transaction to ensure atomic updates and prevent race conditions.
 * @param gameRoomId The ID of the game room.
 * @param finalAnswerLogs The final list of answer logs from the client (as plain objects).
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalAnswerLogs: Omit<AnswerLog, 'timestamp'> & { timestamp: Date }[]) {
    try {
        await db.runTransaction(async (transaction) => {
            const roomRef = db.collection('game-rooms').doc(gameRoomId);
            const roomSnap = await transaction.get(roomRef);

            if (!roomSnap.exists) {
                throw new Error("Game room not found.");
            }

            const gameRoom = roomSnap.data();

            if (gameRoom?.status === 'finished') {
                console.log("Game already finished. Aborting stat recording.");
                return;
            }
            
            const serverAnswerLogs = finalAnswerLogs.map(log => ({
                ...log,
                timestamp: AdminTimestamp.fromDate(new Date(log.timestamp)),
            }));
            
            transaction.update(roomRef, { 
                status: 'finished',
                answerLogs: serverAnswerLogs,
            });

            const playerUIDs = Array.from(new Set(serverAnswerLogs.map(log => log.userId).filter(Boolean))) as string[];
            
            const scores: Record<string, number> = {};
            playerUIDs.forEach(uid => scores[uid] = 0);

            serverAnswerLogs.forEach(log => {
                if (log.userId && typeof log.pointsAwarded === 'number') {
                    scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
                }
            });
            
            const userRefs = playerUIDs.map(uid => db.collection('users').doc(uid));
            const userSnaps = await transaction.getAll(...userRefs);
            
            userSnaps.forEach(userSnap => {
                if (userSnap.exists) {
                    const userRef = userSnap.ref;
                    const xpGained = scores[userSnap.id] || 0;
                    
                    if (xpGained > 0) {
                        transaction.update(userRef, { xp: FieldValue.increment(xpGained) });
                    }
                }
            });

            const incorrectLogs = serverAnswerLogs.filter(log => !log.isCorrect && log.question && ['subjective', 'multipleChoice', 'ox'].includes(log.question.type));

            for (const log of incorrectLogs) {
                if(log.userId && log.question) {
                     const incorrectAnswerRef = db.collection('users').doc(log.userId).collection('incorrect-answers').doc(log.id || uuidv4());
                     transaction.set(incorrectAnswerRef, {
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
        });
        console.log(`Successfully finished game and recorded stats for room ${gameRoomId}.`);
    } catch (error) {
        console.error("Error finishing game and recording stats:", error);
        throw new Error('게임 종료 및 기록 저장 중 오류가 발생했습니다.');
    }
}
