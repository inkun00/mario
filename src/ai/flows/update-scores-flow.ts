
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
import type { GameRoom, AnswerLog, Player } from '@/lib/types';


// Initialize Firebase Admin SDK if not already done.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

const PlayerSchema = z.object({
    uid: z.string(),
    nickname: z.string(),
    score: z.number(),
    avatarId: z.string(),
    isHost: z.boolean().optional(),
});

const UpdateScoresInputSchema = z.object({
  gameRoomId: z.string().describe("The ID of the game room to process."),
  players: z.array(PlayerSchema).describe("The final list of players with their scores."),
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
  async ({ gameRoomId, players }) => {
    if (!gameRoomId || !players) {
      throw new Error("Game room ID and final player scores are required.");
    }

    try {
      const roomRef = db.collection('game-rooms').doc(gameRoomId);
      const roomSnap = await roomRef.get();

      if (!roomSnap.exists) {
        throw new Error("Game room not found.");
      }
      
      const gameRoom = roomSnap.data() as GameRoom;
      const answerLogs = gameRoom.answerLogs || [];
      const batch = db.batch();
      
      // 1. Update player XP using the final scores passed from the client
      for (const player of players) {
        if (player.uid && player.score > 0) {
          const userRef = db.collection('users').doc(player.uid);
          batch.update(userRef, {
            xp: FieldValue.increment(player.score),
            lastPlayed: FieldValue.serverTimestamp(),
          });
        }
      }

      // 2. Process answer logs and add to user subcollections
      for (const log of answerLogs) {
          if (log.userId) { // Ensure there is a userId to log against
            const questionData = log.question as any; // Type assertion to access properties
            if (log.isCorrect) {
                const correctAnswersRef = db.collection('users', log.userId, 'correct-answers').doc();
                batch.set(correctAnswersRef, {
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: questionData.question,
                    grade: questionData.subject || '',
                    semester: questionData.subject || '',
                    subject: questionData.subject || '',
                    unit: questionData.unit || '',
                    timestamp: log.timestamp,
                });
            } else {
                const incorrectAnswersRef = db.collection('users', log.userId, 'incorrect-answers').doc();
                batch.set(incorrectAnswersRef, {
                    gameSetId: log.gameSetId,
                    gameSetTitle: log.gameSetTitle,
                    question: questionData,
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
      throw new Error(`Failed to update scores: ${error.message}`);
    }
  }
);
