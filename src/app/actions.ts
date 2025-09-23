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
    gameRoomId: string;
    players: Player[];
    totalQuestions: number;
}

/**
 * Updates player scores and XP in Firestore after a game finishes.
 * @param input - The game result data.
 */
export async function updateScores(input: UpdateScoresInput): Promise<{ success: boolean }> {
  const { players } = input;
  if (!players || players.length === 0) {
    console.log("No players to update.");
    return { success: true };
  }

  const batch = db.batch();

  try {
    for (const player of players) {
      if (!player.uid) continue;

      const userRef = db.collection('users').doc(player.uid);
      const xpGained = player.score; 

      batch.update(userRef, {
        xp: FieldValue.increment(xpGained),
        lastPlayed: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    console.log(`Scores and XP updated for ${players.length} players.`);
    return { success: true };
  } catch (error) {
    console.error("Error updating scores in server action:", error);
    // This error is caught on the server, will not bubble up to client unless thrown
    return { success: false };
  }
}