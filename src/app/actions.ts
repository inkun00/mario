
'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import type { User, Player, AnswerLog } from '@/lib/types';

// Initialize Firebase Admin SDK for server-side execution.
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
 * Checks if a user exists in the database by their email.
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
        throw new Error('사용자 확인 중 서버 오류가 발생했습니다.');
    }
}


interface UpdateScoresInput {
    players: Player[];
    answerLogs: (Omit<AnswerLog, 'timestamp'> & { timestamp?: number | AdminTimestamp })[];
}

/**
 * Updates player scores and XP, and records incorrect answers in Firestore after a game finishes.
 * @param input - The game result data including players and answer logs.
 */
export async function updateScores(input: UpdateScoresInput): Promise<{ success: boolean; message?: string }> {
  const { players, answerLogs } = input;

  if (!players || players.length === 0) {
    console.log("No players to update scores for.");
    return { success: true };
  }

  const batch = db.batch();

  try {
    // 1. Update player XP
    for (const player of players) {
      if (!player.uid) {
        console.warn("Skipping player with missing UID:", player);
        continue;
      }
      
      const xpGained = player.score;
      if (typeof xpGained !== 'number' || isNaN(xpGained)) {
         console.warn(`Skipping player with invalid score: ${player.uid}`, player);
         continue;
      }

      const userRef = db.collection('users').doc(player.uid);
      
      batch.update(userRef, {
        xp: FieldValue.increment(xpGained),
        lastPlayed: FieldValue.serverTimestamp(),
      });
    }

    // 2. Record all answer logs
    if (answerLogs && answerLogs.length > 0) {
        for (const log of answerLogs) {
            if (!log.userId || !log.question) continue;

            const logWithServerTimestamp = {
              ...log,
              timestamp: log.timestamp ? AdminTimestamp.fromMillis(log.timestamp as number) : FieldValue.serverTimestamp(),
            };

            // Save to top-level answerLogs collection
            const logRef = db.collection('answerLogs').doc();
            batch.set(logRef, logWithServerTimestamp);


            // Keep separate incorrect answers collection for review feature
            if (!log.isCorrect) {
                const incorrectAnswerRef = db.collection('users').doc(log.userId).collection('incorrect-answers').doc();
                batch.set(incorrectAnswerRef, {
                    userId: log.userId,
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: log.question,
                    userAnswer: log.userAnswer || '',
                    timestamp: logWithServerTimestamp.timestamp,
                });
            }
        }
    }


    await batch.commit();
    console.log(`Scores and logs successfully updated for ${players.length} players.`);
    return { success: true };
    
  } catch (error) {
    console.error("Error updating scores and logs in server action:", error);
    return { success: false, message: 'An error occurred while updating scores and logs.' };
  }
}
