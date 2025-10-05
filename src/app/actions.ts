
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer, Question } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

type PlayerStat = {
  uid: string;
  xp: number;
};


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
export async function finishGameAndRecordStats(
  gameRoomId: string,
  finalLogsForXp: PlayerStat[]
) {
  try {
    const batch = adminDb.batch();

    // 1. 모든 플레이어의 XP를 업데이트합니다.
    finalLogsForXp.forEach(playerStat => {
      if (playerStat.uid && playerStat.xp > 0) {
        const userRef = adminDb.collection('users').doc(playerStat.uid);
        // 호스트 권한으로 업데이트하기 위해 gameRoomId를 데이터에 포함합니다.
        batch.update(userRef, {
          xp: FieldValue.increment(playerStat.xp),
          gameRoomId: gameRoomId 
        });
      }
    });
    
    const gameSetId = (await adminDb.collection('game-rooms').doc(gameRoomId).get()).data()?.gameSetId;
    if (gameSetId) {
        const playerUIDs = Array.from(new Set(finalLogsForXp.map(p => p.uid)));
        playerUIDs.forEach(uid => {
            const playedGameSetRef = adminDb.collection('users').doc(uid).collection('playedGameSets').doc(gameSetId);
            batch.set(playedGameSetRef, {
                gameSetId: gameSetId,
                playedAt: AdminTimestamp.now(),
                gameRoomId: gameRoomId,
            });
        });
    }


    // 2. 게임방 상태를 'finished'로 변경합니다. (이 작업은 이제 클라이언트에서 처리되므로 주석 처리하거나 제거할 수 있습니다.)
    // const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
    // batch.update(gameRoomRef, { status: 'finished' });

    // 3. 배치 작업을 한번에 실행합니다.
    await batch.commit();

    return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };

  } catch (error) {
    console.error("Error in finishGameAndRecordStats:", error);
    // 실제 오류 메시지를 반환하여 디버깅을 돕습니다.
    return { success: false, message: "결과 저장 중 오류가 발생했습니다.", error: (error as Error).message };
  }
}
