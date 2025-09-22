'use server';

/**
 * @fileOverview An AI agent that securely updates player scores and XP at the end of a game.
 *
 * - updateScores - A function that processes the final scores and updates user documents.
 * - UpdateScoresInput - The input type for the updateScores function.
 * - UpdateScoresOutput - The return type for the updateScores function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';

// Initialize Firebase Admin SDK if not already done.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();


const PlayerScoreSchema = z.object({
  uid: z.string().describe("The player's unique ID."),
  score: z.number().describe("The final score achieved by the player in the game."),
});

const UpdateScoresInputSchema = z.object({
  players: z.array(PlayerScoreSchema).describe("A list of all players and their final scores."),
});
export type UpdateScoresInput = z.infer<typeof UpdateScoresInputSchema>;

const UpdateScoresOutputSchema = z.object({
  success: z.boolean().describe("Whether the score update was successful."),
  message: z.string().describe("A summary of the operation."),
});
export type UpdateScoresOutput = z.infer<typeof UpdateScoresOutputSchema>;

export async function updateScores(input: UpdateScoresInput): Promise<UpdateScoresOutput> {
  return updateScoresFlow(input);
}

const updateScoresFlow = ai.defineFlow(
  {
    name: 'updateScoresFlow',
    inputSchema: UpdateScoresInputSchema,
    outputSchema: UpdateScoresOutputSchema,
  },
  async ({ players }) => {
    if (!players || players.length === 0) {
      return { success: false, message: "No players provided to update." };
    }

    try {
      const batch = db.batch();
      
      for (const player of players) {
        if (player.uid && player.score > 0) {
          const userRef = db.collection('users').doc(player.uid);
          // Use FieldValue.increment to avoid race conditions.
          batch.update(userRef, {
            xp: FieldValue.increment(player.score),
            lastPlayed: FieldValue.serverTimestamp(),
          });
        }
      }

      await batch.commit();

      const message = `Successfully updated scores for ${players.length} players.`;
      console.log(message);
      return { success: true, message };

    } catch (error: any) {
      console.error("Error updating scores in updateScoresFlow:", error);
      // It's better to throw the error so the client-side can know something went wrong.
      throw new Error(`Failed to update scores: ${error.message}`);
    }
  }
);
