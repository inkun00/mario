export interface User {
  uid: string;
  email: string | null;
  nickname: string;
  xp: number;
  level: number;
}

export interface Question {
  question: string;
  points: number;
  hasMysteryBox: boolean;
  type: 'subjective' | 'multipleChoice';
  // for subjective
  answer?: string;
  // for multiple choice
  options?: string[];
  correctAnswer?: string;
}

export interface GameSet {
  id: string;
  creatorId: string;
  creatorNickname: string;
  title: string;
  description: string;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
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
