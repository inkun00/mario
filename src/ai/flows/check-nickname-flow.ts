
'use server';

/**
 * @fileOverview An AI agent that checks for the existence of a user ID.
 *
 * - checkUserId - A function that checks if a user ID exists.
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
    
    // This is not a secure way to check for users. 
    // It's a temporary solution for the local lobby functionality.
    // A proper user search service should be implemented.
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('displayName', '==', userId).limit(1).get();

    if (!snapshot.empty) {
      return { exists: true };
    }

    return { exists: false };
  }
);

  
