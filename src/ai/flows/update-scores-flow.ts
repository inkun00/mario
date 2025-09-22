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
import type { GameRoom, AnswerLog } from '@/lib/types';


// Initialize Firebase Admin SDK if not already done.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();


const UpdateScoresInputSchema = z.object({
  gameRoomId: z.string().describe("The ID of the game room to process."),
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
  async ({ gameRoomId }) => {
    if (!gameRoomId) {
      return { success: false, message: "Game room ID is required." };
    }

    try {
      const roomRef = db.collection('game-rooms').doc(gameRoomId);
      const roomSnap = await roomRef.get();

      if (!roomSnap.exists) {
        return { success: false, message: "Game room not found." };
      }

      const gameRoom = roomSnap.data() as GameRoom;
      const players = Object.values(gameRoom.players);
      const answerLogs = gameRoom.answerLogs || [];
      
      if (!players || players.length === 0) {
        return { success: false, message: "No players found in the game room." };
      }
      
      // Calculate final scores from answerLogs
      const finalScores: Record<string, number> = {};
      players.forEach(p => {
        finalScores[p.uid] = 0;
      });
      answerLogs.forEach(log => {
        if (log.userId && log.isCorrect && log.pointsAwarded) {
          finalScores[log.userId] = (finalScores[log.userId] || 0) + log.pointsAwarded;
        }
      });

      const batch = db.batch();
      
      // 1. Update player XP using calculated final scores
      for (const player of players) {
        const finalScore = finalScores[player.uid] || 0;
        if (player.uid && finalScore > 0) {
          const userRef = db.collection('users').doc(player.uid);
          batch.update(userRef, {
            xp: FieldValue.increment(finalScore),
            lastPlayed: FieldValue.serverTimestamp(),
          });
        }
      }

      // 2. Process answer logs and add to user subcollections
      for (const log of answerLogs) {
          if (log.userId) { // Ensure there is a userId to log against
            if (log.isCorrect) {
                const correctAnswersRef = db.collection('users', log.userId, 'correct-answers').doc();
                batch.set(correctAnswersRef, {
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: log.question.question,
                    grade: log.question.subject || '',
                    semester: log.question.subject || '',
                    subject: log.question.subject || '',
                    unit: log.question.unit || '',
                    timestamp: log.timestamp,
                });
            } else {
                const incorrectAnswersRef = db.collection('users', log.userId, 'incorrect-answers').doc();
                batch.set(incorrectAnswersRef, {
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: log.question,
                    userAnswer: log.userAnswer,
                    timestamp: log.timestamp,
                });
            }
          }
      }
      
      // 3. Mark game as finished
      batch.update(roomRef, { status: 'finished' });

      await batch.commit();

      const message = `Successfully updated scores and logs for ${players.length} players.`;
      console.log(message);
      return { success: true, message };

    } catch (error: any) {
      console.error("Error updating scores in updateScoresFlow:", error);
      // It's better to throw the error so the client-side can know something went wrong.
      throw new Error(`Failed to update scores: ${error.message}`);
    }
  }
);
