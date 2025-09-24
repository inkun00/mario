'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { User, Player } from '@/lib/types';

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
}

/**
 * Updates player scores and XP in Firestore after a game finishes.
 * @param input - The game result data.
 */
export async function updateScores(input: UpdateScoresInput): Promise<{ success: boolean; message?: string }> {
  const { players } = input;
  if (!players || players.length === 0) {
    console.log("No players to update scores for.");
    return { success: true };
  }

  const batch = db.batch();

  try {
    for (const player of players) {
      // Validate player data before updating
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
      
      // Use FieldValue.increment to atomically update the XP
      batch.update(userRef, {
        xp: FieldValue.increment(xpGained),
        lastPlayed: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`Scores and XP successfully updated for ${players.length} players.`);
    return { success: true };
    
  } catch (error) {
    console.error("Error updating scores in server action:", error);
    // Do not throw, just return failure. Client can decide how to handle.
    return { success: false, message: 'An error occurred while updating scores.' };
  }
}
