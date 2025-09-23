'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { User } from '@/lib/types';

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
