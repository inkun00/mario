'use server';

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp as AdminTimestamp, Transaction } from 'firebase-admin/firestore';
import type { User, AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

// Initialize Firebase Admin SDK. This must be done once per server instance.
// In environments like Firebase App Hosting, it automatically finds the service account.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

interface CheckUserResult {
    exists: boolean;
    uid: string | null;
    nickname: string | null;
}

/**
 * Checks if a user exists in the database by their email using Admin privileges.
 * @param userId - The email of the user to check.
 * @returns An object indicating if the user exists, their UID, and their nickname.
 */
export async function checkUserId(userId: string): Promise<CheckUserResult> {
    try {
        const usersRef = db.collection('users');
        const querySnapshot = await usersRef.where('email', '==', userId).limit(1).get();

        if (querySnapshot.empty) {
            return { exists: false, uid: null, nickname: null };
        }

        const userDoc = querySnapshot.docs[0];
        const userData = userDoc.data() as User;

        return {
            exists: true,
            uid: userData.uid,
            nickname: userData.displayName || '이름없음',
        };
    } catch (error) {
        console.error("Error in checkUserId server action:", error);
        // Do not expose detailed server errors to the client
        throw new Error('사용자 확인 중 오류가 발생했습니다.');
    }
}


/**
 * Finishes the game and records stats for all players.
 * This function is designed to be called when the game ends.
 * It uses a transaction to ensure atomic updates and prevent race conditions.
 * @param gameRoomId The ID of the game room.
 * @param finalAnswerLogs The final list of answer logs from the client.
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalAnswerLogs: AnswerLog[]) {
    try {
        await db.runTransaction(async (transaction: Transaction) => {
            const roomRef = db.collection('game-rooms').doc(gameRoomId);
            const roomSnap = await transaction.get(roomRef);

            if (!roomSnap.exists) {
                throw new Error("Game room not found.");
            }

            const gameRoom = roomSnap.data();

            // Prevent multiple executions for the same game
            if (gameRoom?.status === 'finished') {
                console.log("Game already finished. Aborting stat recording.");
                return;
            }

            // Convert date objects from client back to Firestore Timestamps on the server
            const serverAnswerLogs = finalAnswerLogs.map(log => ({
                ...log,
                timestamp: AdminTimestamp.fromDate(new Date(log.timestamp as any)),
            }));


            // 1. Update GameRoom status to 'finished' and save the final logs
            transaction.update(roomRef, { 
                status: 'finished',
                answerLogs: serverAnswerLogs,
            });

            const playerUIDs = Array.from(new Set(serverAnswerLogs.map(log => log.userId).filter(Boolean)));
            
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
                        // 2. Update player XP
                        transaction.update(userRef, { xp: FieldValue.increment(xpGained) });
                    }
                }
            });

            // 3. Record incorrect answers
            const incorrectLogs = serverAnswerLogs.filter(log => !log.isCorrect);

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
        // We throw the error so the client can be notified
        throw new Error('게임 종료 및 기록 저장 중 오류가 발생했습니다.');
    }
}
