'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '@/lib/firebase';
import type { SurvivalGameRoom } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function SurvivalQuizGamePage() {
  const { id: gameRoomId } = useParams();
  const [user, loadingUser] = useAuthState(auth);
  const [gameRoom, setGameRoom] = useState<SurvivalGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!gameRoomId || typeof gameRoomId !== 'string') return;
    const roomRef = doc(db, 'survival-game-rooms', gameRoomId);
    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setGameRoom({ id: docSnap.id, ...docSnap.data() } as SurvivalGameRoom);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [gameRoomId]);

  if (isLoading || loadingUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">게임 불러오는 중...</p>
      </div>
    );
  }
  
  if (!gameRoom) {
      return <div>게임을 찾을 수 없습니다.</div>
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>{gameRoom.roomTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>서바이벌 퀴즈 게임 플레이 화면입니다.</p>
          <p>현재 문제: {gameRoom.currentQuestionIndex + 1} / {gameRoom.allQuestions.length}</p>
          <p>이곳에 게임 로직이 구현될 예정입니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
