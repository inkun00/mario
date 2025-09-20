export interface User {
  uid: string;
  email: string | null;
  nickname: string;
  xp: number;
  level: number;
}

export interface Question {
  question: string;
  answer: string;
  points: number;
  hasMysteryBox: boolean;
}

export interface GameSet {
  id: string;
  creatorId: string;
  creatorNickname: string;
  title: string;
  description: string;
  questions: Question[];
  createdAt: any;
}

export interface Player {
  uid: string;
  nickname: string;
  score: number;
  avatarId: string;
}

export interface GameRoom {
  id: string;
  gameSetId: string;
  password?: string;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  currentTurn: string; // userId
  players: Record<string, Player>; // key is userId
  gameState: Record<string, 'available' | 'answered'>; // key is questionId
}
