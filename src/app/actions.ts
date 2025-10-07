
'use server';

import { FieldValue, Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { FinishGamePayload, IncorrectAnswer, Question } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: IncorrectAnswer) {
    try {
        const { userId, id, gameSetId, gameSetTitle, question, userAnswer, timestamp } = incorrectLog;
        
        if (!userId) {
            console.warn("User ID is missing in recordIncorrectAnswer.");
            return;
        }
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(id || uuidv4());
        
        // Firestore Admin SDK는 Date 객체를 자동으로 Timestamp로 변환하지만, 명시적으로 변환하여 안정성을 높입니다.
        const firestoreTimestamp = (timestamp.toDate) ? AdminTimestamp.fromMillis(timestamp.toDate().getTime()) : timestamp;

        // question 객체의 모든 필드를 명시적으로 저장하여 데이터 유실을 방지합니다.
        const dataToSave = {
            id: id || uuidv4(),
            userId,
            gameSetId,
            gameSetTitle,
            question: {
                id: question.id,
                question: question.question,
                points: question.points,
                type: question.type,
                imageUrl: question.imageUrl || '',
                hint: question.hint || '',
                answer: question.answer || '',
                options: question.options || [],
                correctAnswer: question.correctAnswer || '',
                grade: question.grade || '',
                semester: question.semester || '',
                subject: question.subject || '',
                unit: question.unit || '',
            },
            userAnswer,
            timestamp: firestoreTimestamp,
        };

        await incorrectAnswerRef.set(dataToSave);

    } catch (error: any) {
        console.error("Error recording single incorrect answer:", error);
        // Throwing the error can help in debugging on the server side if needed
        throw new Error(`Failed to record incorrect answer: ${error.message}`);
    }
}


/**
 * 게임 종료 시 플레이어들의 게임 참여 기록을 남기고, 게임 방 상태를 업데이트하는 서버 액션
 */
export async function finishGameAndRecordStats(payload: FinishGamePayload) {
  const { gameRoomId, gameSetId, playerUIDs } = payload;
  try {
    const batch = adminDb.batch();
    
    // 1. Update playedGameSets for each user
    if (playerUIDs && playerUIDs.length > 0) {
      playerUIDs.forEach(uid => {
          const playedGameSetRef = adminDb.collection('users').doc(uid).collection('playedGameSets').doc(gameSetId);
          batch.set(playedGameSetRef, {
              gameSetId: gameSetId,
              playedAt: AdminTimestamp.now(),
              gameRoomId: gameRoomId,
          });
      });
    }
    
    // 2. Finally, mark the game room as finished
    const gameRoomRef = adminDb.collection('game-rooms').doc(gameRoomId);
    batch.update(gameRoomRef, { status: 'finished' });

    await batch.commit();

    return { success: true, message: "게임 결과가 성공적으로 저장되었습니다." };

  } catch (error) {
    console.error("Error in finishGameAndRecordStats:", error);
    return { success: false, message: "결과 저장 중 서버에서 오류가 발생했습니다.", error: (error as Error).message };
  }
}
