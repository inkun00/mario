/**
 * @fileOverview An AI agent that checks for the existence of a user ID and returns their nickname.
 *
 * - checkUserId - A function that checks if a user ID exists and returns the nickname.
 * - CheckUserIdInput - The input type for the checkUserId function.
 * - CheckUserIdOutput - The return type for the checkUserId function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';

const CheckUserIdInputSchema = z.object({
  userId: z.string().describe('The user ID (email) to check.'),
});
export type CheckUserIdInput = z.infer<typeof CheckUserIdInputSchema>;

const CheckUserIdOutputSchema = z.object({
  exists: z.boolean().describe('Whether the user ID exists.'),
  nickname: z.string().describe('The nickname of the user if they exist.'),
  uid: z.string().describe('The unique identifier (UID) of the user if they exist.'),
});
export type CheckUserIdOutput = z.infer<typeof CheckUserIdOutputSchema>;


// Correctly initialize Firebase Admin SDK for server-side execution.
if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();


export async function checkUserId(input: CheckUserIdInput): Promise<CheckUserIdOutput> {
  return checkUserIdFlow(input);
}


const checkUserIdFlow = ai.defineFlow(
  {
    name: 'checkUserIdFlow',
    inputSchema: CheckUserIdInputSchema,
    outputSchema: CheckUserIdOutputSchema,
  },
  async ({ userId }) => {
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', userId).limit(1).get();

        if (snapshot.empty) {
             return { exists: false, nickname: '', uid: '' };
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();
        
        const uid = userDoc.id;
        const nickname = userData.displayName || userId;

        return { exists: true, nickname: nickname, uid: uid };

    } catch(e: any) {
        console.error("Error checking user ID in checkUserIdFlow:", e);
        if (e.code === 'FAILED_PRECONDITION' && e.message.includes('index')) {
             throw new Error('Firestore index is missing. Please create a single-field index on the "email" field in the "users" collection.');
        }
        throw e;
    }
  }
);
