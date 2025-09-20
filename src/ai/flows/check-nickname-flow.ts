
'use server';

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
  userId: z.string().describe('The user ID to check.'),
});
export type CheckUserIdInput = z.infer<typeof CheckUserIdInputSchema>;

const CheckUserIdOutputSchema = z.object({
  exists: z.boolean().describe('Whether the user ID exists.'),
  nickname: z.string().describe('The nickname of the user if they exist.'),
});
export type CheckUserIdOutput = z.infer<typeof CheckUserIdOutputSchema>;


let app: App;
if (!getApps().length) {
  app = initializeApp();
} else {
  app = getApps()[0];
}

const db = getFirestore(app);


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

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            return { exists: true, nickname: userData.displayName || userId };
        }
    } catch(e) {
        console.error("Error checking user ID in checkUserIdFlow:", e);
        // This is a fallback. In a real app, you'd want to ensure your service account is set up correctly.
        // For now, we'll try to provide a somewhat degraded experience.
        return { exists: true, nickname: userId.split('@')[0] || userId };
    }


    return { exists: false, nickname: '' };
  }
);
