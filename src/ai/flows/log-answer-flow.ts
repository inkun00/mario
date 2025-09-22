'use server';

/**
 * @fileOverview An AI agent that securely logs a player's answer and manages game turn progression.
 *
 * - logAnswer - A function that logs an answer and updates the game state.
 * - LogAnswerInput - The input type for the logAnswer function.
 * - LogAnswerOutput - The return type for the logAnswer function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import type { AnswerLog, GameRoom, Question } from '@/lib/types';


// Initialize Firebase Admin SDK if not already done.
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

const QuestionSchema = z.object({
  question: z.string(),
  points: z.number(),
  type: z.enum(['subjective', 'multipleChoice', 'ox']),
  imageUrl: z.string().optional(),
  hint: z.string().optional(),
  answer: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
});

const AnswerLogSchema = z.object({
    userId: z.string(),
    gameSetId: z.string(),
    gameSetTitle: z.string(),
    question: QuestionSchema,
    userAnswer: z.string().optional(),
    isCorrect: z.boolean(),
    pointsAwarded: z.number(),
    timestamp: z.any(),
});

const LogAnswerInputSchema = z.object({
  gameRoomId: z.string().describe("The ID of the game room."),
  answerLog: AnswerLogSchema.describe("The answer log to be added."),
  nextTurn: z.boolean().optional().default(true).describe("Whether to advance to the next turn after logging."),
});
export type LogAnswerInput = z.infer<typeof LogAnswerInputSchema>;

const LogAnswerOutputSchema = z.object({
  success: z.boolean().describe("Whether the answer logging was successful."),
});
export type LogAnswerOutput = z.infer<typeof LogAnswerOutputSchema>;

export async function logAnswer(input: LogAnswerInput): Promise<LogAnswerOutput> {
  return logAnswerFlow(input);
}

const logAnswerFlow = ai.defineFlow(
  {
    name: 'logAnswerFlow',
    inputSchema: LogAnswerInputSchema,
    outputSchema: LogAnswerOutputSchema,
  },
  async ({ gameRoomId, answerLog, nextTurn }) => {
    if (!gameRoomId || !answerLog) {
      throw new Error("Game room ID and answer log are required.");
    }

    try {
      const roomRef = db.collection('game-rooms').doc(gameRoomId);

      // We need the current room state to determine the next turn
      const roomSnap = await roomRef.get();
      if (!roomSnap.exists) {
          throw new Error("Game room not found.");
      }
      const gameRoom = roomSnap.data() as GameRoom;

      const updates: Record<string, any> = {
        answerLogs: FieldValue.arrayUnion(answerLog),
        [`gameState.${(answerLog.question as any).id}`]: 'answered',
      };
      
      // Calculate and set next turn if requested
      if (nextTurn) {
        const playerUIDs = Object.keys(gameRoom.players);
        const currentTurnIndex = playerUIDs.indexOf(gameRoom.currentTurn);
        const nextTurnIndex = (currentTurnIndex + 1) % playerUIDs.length;
        updates.currentTurn = playerUIDs[nextTurnIndex];
      }
      
      await roomRef.update(updates);
      
      return { success: true };

    } catch (error: any) {
      console.error("Error logging answer in logAnswerFlow:", error);
      throw new Error(`Failed to log answer: ${error.message}`);
    }
  }
);
