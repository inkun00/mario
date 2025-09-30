'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Finishes the game and records stats for all players using the Admin SDK.
 * This function runs with admin privileges and bypasses all security rules.
 * @param gameRoomId The ID of the game room.
 * @param finalAnswerLogs The final list of answer logs from the client.
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalAnswerLogs: Omit<AnswerLog, 'timestamp'> & { timestamp: Date }[]) {
    try {
        await adminDb.runTransaction(async (transaction) => {
            const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
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

            const incorrectLogs = serverAnswerLogs.filter(log => !log.isCorrect && log.question && ['subjective', 'multipleChoice', 'ox'].includes(log.question.type));

            for (const log of incorrectLogs) {
                if(log.userId && log.question) {
                     const incorrectAnswerRef = adminDb.collection('users').doc(log.userId).collection('incorrect-answers').doc(log.id || uuidv4());
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
        console.error("Error in finishGameAndRecordStats transaction:", error);
        throw new Error('Failed to finish game and record stats.');
    }
}
