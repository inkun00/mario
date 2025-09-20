
'use server';

/**
 * @fileOverview An AI agent that checks for the existence of a nickname.
 *
 * - checkNickname - A function that checks if a nickname exists.
 * - CheckNicknameInput - The input type for the checkNickname function.
 * - CheckNicknameOutput - The return type for the checkNickname function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';

const CheckNicknameInputSchema = z.object({
  nickname: z.string().describe('The nickname to check.'),
});
export type CheckNicknameInput = z.infer<typeof CheckNicknameInputSchema>;

const CheckNicknameOutputSchema = z.object({
  exists: z.boolean().describe('Whether the nickname exists.'),
});
export type CheckNicknameOutput = z.infer<typeof CheckNicknameOutputSchema>;


let app: App;
if (!getApps().length) {
  app = initializeApp();
} else {
  app = getApps()[0];
}

const db = getFirestore(app);


export async function checkNickname(input: CheckNicknameInput): Promise<CheckNicknameOutput> {
  return checkNicknameFlow(input);
}


const checkNicknameFlow = ai.defineFlow(
  {
    name: 'checkNicknameFlow',
    inputSchema: CheckNicknameInputSchema,
    outputSchema: CheckNicknameOutputSchema,
  },
  async ({ nickname }) => {
    
    const gameSetsRef = db.collection('game-sets');
    const snapshot = await gameSetsRef.where('creatorNickname', '==', nickname).limit(1).get();

    if (!snapshot.empty) {
      return { exists: true };
    }
    
    // Potentially check other collections if nicknames are stored elsewhere
    // For now, we only check game-sets creators.

    return { exists: false };
  }
);
