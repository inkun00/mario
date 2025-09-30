
'use server';

import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { IncorrectAnswer, AnswerLog } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 실시간으로 오답 1건을 기록하는 가벼운 서버 액션
 */
export async function recordIncorrectAnswer(incorrectLog: Omit<IncorrectAnswer, 'timestamp'> & { timestamp: Date }) {
    try {
        const { userId, ...rest } = incorrectLog;
        if (!userId) {
            // userId가 없는 경우 그냥 무시
            return;
        }
        
        const incorrectAnswerRef = adminDb.collection('users').doc(userId).collection('incorrect-answers').doc(incorrectLog.id || uuidv4());
        // Here, we can directly set the JS Date object, Firestore Admin SDK will convert it.
        await incorrectAnswerRef.set({
            ...rest,
            userId,
            timestamp: incorrectLog.timestamp, 
        });

    } catch (error) {
        console.error("Error recording single incorrect answer:", error);
        // 이 오류는 사용자에게 직접적인 영향을 주지 않으므로, 에러를 던지지 않고 로깅만 합니다.
    }
}


/**
 * 트랜잭션을 Batched Write로 변경하여 극적으로 경량화된 최종 함수
 */
export async function finishGameAndRecordStats(gameRoomId: string, finalLogsForXp: { userId: string, pointsAwarded: number }[]) {
    try {
        // --- ▼▼▼ 디버깅 코드 추가 ▼▼▼ ---
        console.log("--- finishGameAndRecordStats 실행 ---");
        console.log("클라이언트로부터 받은 데이터:", JSON.stringify(finalLogsForXp, null, 2));
        // --- ▲▲▲ 디버깅 코드 추가 ▲▲▲ ---

        // 1. 트랜잭션 없이 게임방 존재 여부만 빠르게 확인
        const roomRef = adminDb.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();

        if (!roomSnap.exists) {
            throw new Error("Game room not found.");
        }
        
        // 2. 메모리에서 점수 집계 (매우 빠름)
        const playerUIDs = Array.from(new Set(finalLogsForXp.map(log => log.userId).filter(Boolean))) as string[];
        
        // --- ▼▼▼ 디버깅 코드 추가 ▼▼▼ ---
        console.log("XP를 업데이트할 필터링된 UID 목록:", playerUIDs);
        // --- ▲▲▲ 디버깅 코드 추가 ▲▲▲ ---
        
        const scores: Record<string, number> = {};
        playerUIDs.forEach(uid => scores[uid] = 0);

        finalLogsForXp.forEach(log => {
            if (log.userId && typeof log.pointsAwarded === 'number') {
                scores[log.userId] = (scores[log.userId] || 0) + log.pointsAwarded;
            }
        });
        
        // 3. Batched Write 생성
        const batch = adminDb.batch();

        playerUIDs.forEach(uid => {
            const xpGained = scores[uid] || 0;
            if (xpGained !== 0) {
                const userRef = adminDb.collection('users').doc(uid);
                // 읽기 작업 없이 업데이트 작업만 배치에 추가
                batch.update(userRef, { xp: FieldValue.increment(xpGained) });
            }
        });

        // 4. 모든 XP 업데이트를 한 번의 요청으로 커밋 (매우 빠름)
        await batch.commit();

        console.log(`Successfully finished game and updated XP for room ${gameRoomId}.`);

    } catch (error) {
        console.error("Error in finishGameAndRecordStats:", error);
        // --- ▼▼▼ 디버깅 코드 추가 ▼▼▼ ---
        // 실제 Firestore에서 발생한 구체적인 에러 내용을 확인하기 위해 error 객체 전체를 로깅합니다.
        console.error("발생한 전체 오류 객체:", error);
        // --- ▲▲▲ 디버깅 코드 추가 ▲▲▲ ---
        throw new Error('Failed to finish game and record stats.');
    }
}
