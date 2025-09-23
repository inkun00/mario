/**
 * @fileOverview An AI agent that securely updates player scores and XP at the end of a game.
 *
 * - updateScores - A function that processes the final scores and updates user documents.
 * - UpdateScoresInput - The input type for the updateScores function.
 * - UpdateScoresOutput - The return type for the updateScoresOutput function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import type { GameRoom, Player, AnswerLog } from '@/lib/types';


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
  totalQuestions: z.number().describe("The total number of questions in the game set."),
});
export type UpdateScoresInput = z.infer<typeof UpdateScoresInputSchema>;

const UpdateScoresOutputSchema = z.object({
  success: z.boolean().describe("Whether the score update was successful."),
  message: z.string().describe("A summary of the operation."),
});
export type UpdateScoresOutput = z.infer<typeof UpdateScoresOutputSchema>;


/**
 * Calculates the XP reward based on player's rank, total players, and question count.
 * @param rank The player's final rank (1-based index).
 * @param totalPlayers The total number of players in the game.
 * @param totalQuestions The total number of questions in the game set.
 * @returns The amount of XP to award.
 */
function calculateTotalXp(rank: number, totalPlayers: number, totalQuestions: number): number {
    const rankRewardTable: Record<number, number[]> = {
        2: [30, 10],
        3: [50, 30, 10],
        4: [70, 50, 20, 10],
        5: [90, 60, 40, 20, 10],
        6: [100, 70, 50, 30, 20, 10],
    };

    const rewards = rankRewardTable[totalPlayers] || rankRewardTable[6];
    
    let rankPoints;
    if (rank > rewards.length) {
        rankPoints = rewards[rewards.length - 1] || 10; // Default to lowest reward
    } else {
        rankPoints = rewards[rank - 1]; // rank is 1-based, array is 0-based
    }
    
    // Add bonus XP based on the number of questions (e.g., 1 XP per question)
    const questionBonus = totalQuestions;
    
    return rankPoints + questionBonus;
}

// Helper to remove undefined properties from an object
const removeUndefined = (obj: any) => {
    const newObj = {...obj};
    Object.keys(newObj).forEach(key => {
        if (newObj[key] === undefined) {
            delete newObj[key];
        }
    });
    return newObj;
};


export async function updateScores(input: UpdateScoresInput): Promise<UpdateScoresOutput> {
  return updateScoresFlow(input);
}

const updateScoresFlow = ai.defineFlow(
  {
    name: 'updateScoresFlow',
    inputSchema: UpdateScoresInputSchema,
    outputSchema: UpdateScoresOutputSchema,
  },
  async ({ gameRoomId, players, totalQuestions }) => {
    if (!gameRoomId || !players || players.length === 0) {
      throw new Error("Game room ID and final player scores are required.");
    }

    const roomRef = db.collection('game-rooms').doc(gameRoomId);
    
    try {
      const roomSnap = await roomRef.get();
      if (!roomSnap.exists) {
        throw new Error(`Game room with ID ${gameRoomId} not found.`);
      }
      const gameRoomData = roomSnap.data() as GameRoom;
      const answerLogs = gameRoomData.answerLogs || [];

      // Sort players by score to determine rank.
      const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
      const totalPlayers = rankedPlayers.length;

      const batch = db.batch();
      
      // 1. Update player XP based on their rank and total questions.
      for (let i = 0; i < rankedPlayers.length; i++) {
        const player = rankedPlayers[i];
        const rank = i + 1; // 1-based rank
        
        if (player.uid) {
          const xpGained = calculateTotalXp(rank, totalPlayers, totalQuestions);
          
          const userRef = db.collection('users').doc(player.uid);
          batch.update(userRef, {
            xp: FieldValue.increment(xpGained),
            lastPlayed: Timestamp.now(),
          });
        }
      }

      // 2. Process answer logs
      for (const log of answerLogs) {
          if (!log.userId || !log.question) continue;

          // Convert JS Date back to Firestore Timestamp if it's not already one
          const timestamp = (log.timestamp && !(log.timestamp instanceof Timestamp)) 
            ? Timestamp.fromDate(new Date(log.timestamp as any)) 
            : log.timestamp || Timestamp.now();

          if (log.isCorrect) {
              const correctAnswerRef = db.collection('users').doc(log.userId).collection('correct-answers').doc();
              const data = {
                  gameSetId: log.gameSetId,
                  gameSetTitle: log.gameSetTitle,
                  question: log.question.question,
                  grade: log.question.grade,
                  semester: log.question.semester,
                  subject: log.question.subject,
                  unit: log.question.unit,
                  timestamp: timestamp
              };
              batch.set(correctAnswerRef, removeUndefined(data));
          } else {
              const incorrectAnswerRef = db.collection('users').doc(log.userId).collection('incorrect-answers').doc();
              const data = {
                  userId: log.userId,
                  gameSetId: log.gameSetId,
                  gameSetTitle: log.gameSetTitle,
                  question: log.question,
                  userAnswer: log.userAnswer,
                  timestamp: timestamp
              };
              batch.set(incorrectAnswerRef, removeUndefined(data));
          }
      }
      
      await batch.commit();

      const message = `Successfully updated XP and answer logs for ${players.length} players.`;
      console.log(message);
      
      return { success: true, message };

    } catch (error: any) {
      console.error("Error updating scores in updateScoresFlow:", error);
      // It's crucial to throw an error that the client can understand.
      throw new Error(`Failed to update scores on the server: ${error.message}`);
    }
  }
);
