'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer, AnswerLog, FinishGamePayload } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: Omit<IncorrectAnswer, 'timestamp'> & { timestamp: Date }) {
    try {
        const { userId, ...rest } = incorrectLog;
        if (!userId) {
            return { success: false, message: "User ID is missing." };
        }
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(incorrectLog.id || uuidv4());
        
        // Convert JS Date to Firestore Timestamp for admin SDK
        await incorrectAnswerRef.set({
            ...rest,
            userId,
            timestamp: AdminTimestamp.fromDate(new Date(incorrectLog.timestamp)), 
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error recording single incorrect answer:", error);
        return { success: false, message: `Failed to record incorrect answer: ${error.message}` };
    }
}


/**
 * 게임 종료 시 플레이어들의 점수를 업데이트하고 게임 상태를 변경하는 서버 액션
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
  const { gameRoomId, gameSetId, answerLogs } = payload;
  try {
    const batch = adminDb.batch();
    
    const xpGains: Record<string, number> = {};
    const playerUIDs = Array.from(new Set(answerLogs.map(log => log.userId)));

    answerLogs.forEach(log => {
      // 1. Save the full answer log to the 'answerLogs' collection
      if (log.userId && log.question) {
        const logRef = adminDb.collection('answerLogs').doc(log.id || uuidv4());
        const logData = {
            ...log,
            timestamp: AdminTimestamp.now(), // Use server timestamp for consistency
        };
        batch.set(logRef, logData);
      }
      
      // 2. Aggregate XP gains for each user
      if (log.userId && typeof log.pointsAwarded === 'number') {
        xpGains[log.userId] = (xpGains[log.userId] || 0) + log.pointsAwarded;
      }
    });

    // 3. Update user XP and playedGameSets
    for (const uid of playerUIDs) {
        if (uid) {
            const userRef = adminDb.collection('users').doc(uid);
            const xpGained = xpGains[uid] || 0;
            if (xpGained > 0) {
                batch.update(userRef, { xp: FieldValue.increment(xpGained) });
            }

            const playedGameSetRef = userRef.collection('playedGameSets').doc(gameSetId);
            batch.set(playedGameSetRef, {
                gameSetId: gameSetId,
                playedAt: AdminTimestamp.now(),
                gameRoomId: gameRoomId,
            });
        }
    }
    
    // 4. Finally, mark the game room as finished
    const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
    batch.update(gameRoomRef, { status: 'finished' });

    await batch.commit();

    return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };

  } catch (error) {
    console.error("Error in finishGameAndRecordStats:", error);
    return { success: false, message: "결과 저장 중 오류가 발생했습니다.", error: (error as Error).message };
  }
}
