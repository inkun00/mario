'use server';

/**
 * @fileOverview A Genkit flow to handle a player joining a game room.
 *
 * - joinGame - A function that allows a player to join a game room.
 * - JoinGameInput - The input type for the joinGame function.
 * - JoinGameOutput - The return type for the joinGame function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import type { Player, GameRoom } from '@/lib/types';

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

const JoinGameInputSchema = z.object({
  gameRoomId: z.string().describe("The ID of the game room to join."),
  player: PlayerSchema.describe("The player object of the user who wants to join."),
});
export type JoinGameInput = z.infer<typeof JoinGameInputSchema>;

const JoinGameOutputSchema = z.object({
  success: z.boolean().describe("Whether the player successfully joined."),
  message: z.string().describe("A message indicating the result of the operation."),
});
export type JoinGameOutput = z.infer<typeof JoinGameOutputSchema>;

export async function joinGame(input: JoinGameInput): Promise<JoinGameOutput> {
  return joinGameFlow(input);
}

const joinGameFlow = ai.defineFlow(
  {
    name: 'joinGameFlow',
    inputSchema: JoinGameInputSchema,
    outputSchema: JoinGameOutputSchema,
  },
  async ({ gameRoomId, player }) => {
    
    if (!gameRoomId || !player) {
      throw new Error("Game room ID and player information are required.");
    }
    
    const roomRef = db.collection('game-rooms').doc(gameRoomId);

    try {
      const roomSnap = await roomRef.get();

      if (!roomSnap.exists) {
        return { success: false, message: '존재하지 않는 게임방입니다.' };
      }

      const roomData = roomSnap.data() as GameRoom;
      
      if (roomData.joinType !== 'remote') {
        return { success: true, message: '로컬 게임방입니다. 로비로 이동합니다.' };
      }
      
      const playerUIDs = Object.keys(roomData.players || {});

      if (playerUIDs.includes(player.uid)) {
        return { success: true, message: '이미 참여한 게임방입니다. 로비로 이동합니다.'};
      }

      if (playerUIDs.length >= 6) {
         return { success: false, message: '게임방이 가득 찼습니다.' };
      }

      await roomRef.update({
        [`players.${player.uid}`]: player,
      });

      return { success: true, message: '게임에 참가했습니다. 로비로 이동합니다.' };

    } catch (error: any) {
      console.error(`Error in joinGameFlow for room ${gameRoomId}:`, error);
      throw new Error(`서버에서 게임 참가 처리 중 오류가 발생했습니다: ${error.message}`);
    }
  }
);
