'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { AnswerLog, FinishGamePayload, GameSet } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: Omit<AnswerLog, 'isCorrect' | 'pointsAwarded' | 'timestamp'> & { timestamp: Date }) {
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
            isCorrect: false, // Explicitly set for context
            timestamp: AdminTimestamp.fromDate(new Date(incorrectLog.timestamp)), 
        });

        return { success: true };

    } catch (error: any) {
        console.error("Error recording single incorrect answer:", error);
        return { success: false, message: `Failed to record incorrect answer: ${error.message}` };
    }
}


/**
 * 게임 종료 시 플레이어들의 점수를 업데이트하고 완전한 학습 로그를 기록하는 서버 액션
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
  const { gameRoomId, gameSetId, answerLogs } = payload;
  try {
    const batch = adminDb.batch();
    
    // 1. Get GameSet metadata
    const gameSetRef = adminDb.collection('game-sets').doc(gameSetId);
    const gameSetSnap = await gameSetRef.get();
    if (!gameSetSnap.exists) {
        throw new Error(`GameSet with id ${gameSetId} not found.`);
    }
    const gameSetData = gameSetSnap.data() as GameSet;

    const xpGains: Record<string, number> = {};

    answerLogs.forEach(log => {
      // 2. Enrich log with GameSet metadata and save to 'answerLogs' collection
      if (log.userId && log.question) {
        const logRef = adminDb.collection('answerLogs').doc(log.id || uuidv4());
        
        const enrichedQuestion = {
          ...log.question,
          subject: log.question.subject || gameSetData.subject,
          unit: log.question.unit || gameSetData.unit,
          grade: log.question.grade || gameSetData.grade,
          semester: log.question.semester || gameSetData.semester,
        };

        const completeLog: AnswerLog = {
          ...log,
          id: log.id || uuidv4(),
          gameSetId: gameSetId,
          gameSetTitle: gameSetData.title,
          question: enrichedQuestion,
          isCorrect: log.isCorrect,
          pointsAwarded: log.pointsAwarded,
          timestamp: AdminTimestamp.fromDate(new Date(log.timestamp as any)),
        };

        batch.set(logRef, completeLog);

        // 3. Aggregate XP gains for each user
        if (typeof log.pointsAwarded === 'number') {
          xpGains[log.userId] = (xpGains[log.userId] || 0) + log.pointsAwarded;
        }
      }
    });
    
    // 4. Update user XP and playedGameSets
    for (const uid in xpGains) {
        if (Object.prototype.hasOwnProperty.call(xpGains, uid)) {
            const userRef = adminDb.collection('users').doc(uid);
            const xpGained = xpGains[uid] || 0;
            if (xpGained !== 0) {
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
    
    // 5. Finally, mark the game room as finished
    const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
    batch.update(gameRoomRef, { status: 'finished' });

    await batch.commit();

    return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };

  } catch (error) {
    console.error("Error in finishGameAndRecordStats:", error);
    return { success: false, message: "결과 저장 중 오류가 발생했습니다.", error: (error as Error).message };
  }
}
