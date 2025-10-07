
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { FinishGamePayload, IncorrectAnswer, AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';


/**
 * 게임 종료 시 플레이어들의 게임 참여 기록, 경험치, 과목/단원별 통계를 업데이트하는 서버 액션
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
  const { gameRoomId, answerLogs } = payload;
  
  if (!gameRoomId || !answerLogs) {
    throw new Error("Invalid payload: gameRoomId and answerLogs are required.");
  }

  try {
    const batch = adminDb.batch();
    
    const playerUIDs = Array.from(new Set(answerLogs.map(log => log.userId)));

    // 1. Update playedGameSets for each user
    playerUIDs.forEach(uid => {
        const gameSetId = answerLogs.find(log => log.userId === uid)?.question.id;
        if(gameSetId) {
            const playedGameSetRef = adminDb.collection('users').doc(uid).collection('playedGameSets').doc(gameRoomId);
            batch.set(playedGameSetRef, {
                playedAt: AdminTimestamp.now(),
                gameRoomId: gameRoomId,
            });
        }
    });

    // 2. Aggregate XP and subject stats
    const xpUpdates: Record<string, number> = {};
    const subjectStatsUpdate: Record<string, Record<string, any>> = {};

    answerLogs.forEach(log => {
      const { userId, pointsAwarded, isCorrect, subject, unit } = log;
      
      // Aggregate XP
      if (!xpUpdates[userId]) xpUpdates[userId] = 0;
      xpUpdates[userId] += pointsAwarded;

      // Aggregate subject stats
      if (subject) {
        if (!subjectStatsUpdate[userId]) subjectStatsUpdate[userId] = {};
        if (!subjectStatsUpdate[userId][subject]) {
          subjectStatsUpdate[userId][subject] = {
            totalCorrect: 0,
            totalIncorrect: 0,
            units: {}
          };
        }

        const stat = subjectStatsUpdate[userId][subject];
        const countField = isCorrect ? 'totalCorrect' : 'totalIncorrect';
        
        stat[countField] = (stat[countField] || 0) + 1;

        if (unit) {
          if (!stat.units[unit]) {
            stat.units[unit] = { totalCorrect: 0, totalIncorrect: 0 };
          }
          stat.units[unit][countField] = (stat.units[unit][countField] || 0) + 1;
        }
      }
    });

    // 3. Apply XP updates to user documents
    for (const uid in xpUpdates) {
      if (xpUpdates[uid] > 0) {
        const userRef = adminDb.collection('users').doc(uid);
        batch.update(userRef, { xp: FieldValue.increment(xpUpdates[uid]) });
      }
    }
    
    // 4. Apply subject stats updates
    for (const uid in subjectStatsUpdate) {
        for (const subject in subjectStatsUpdate[uid]) {
            const statRef = adminDb.collection('users').doc(uid).collection('subjectStats').doc(subject);
            const stats = subjectStatsUpdate[uid][subject];

            const updatePayload: Record<string, any> = {
                totalCorrect: FieldValue.increment(stats.totalCorrect),
                totalIncorrect: FieldValue.increment(stats.totalIncorrect),
            };

            for (const unit in stats.units) {
                const unitStats = stats.units[unit];
                updatePayload[`units.${unit}.totalCorrect`] = FieldValue.increment(unitStats.totalCorrect);
                updatePayload[`units.${unit}.totalIncorrect`] = FieldValue.increment(unitStats.totalIncorrect);
            }
            
            batch.set(statRef, updatePayload, { merge: true });
        }
    }

    // 5. Finally, mark the game room as finished
    const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
    batch.update(gameRoomRef, { status: 'finished' });

    await batch.commit();

    return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };

  } catch (error) {
    console.error("Error in finishGameAndRecordStats:", error);
    // Throw a more specific error to the client
    throw new Error(`Failed to record game stats: ${(error as Error).message}`);
  }
}
