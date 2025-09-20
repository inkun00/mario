
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
  type: 'subjective' | 'multipleChoice' | 'ox';
  hint?: string;
  // for subjective
  answer?: string;
  // for multiple choice or ox
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
  isPublic: boolean;
  questions: Question[];
  createdAt: any;
}

export interface Player {
  uid: string;
  nickname:string;
  score: number;
  avatarId: string;
  isHost?: boolean;
}

export type JoinType = 'remote' | 'local';

export interface LocalPlayer {
    userId: string;
    confirmed: boolean;
}

export interface GameRoom {
  id: string;
  gameSetId: string;
  password?: string;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  currentTurn: string; // userId or nickname for local
  players: Record<string, Player>; // key is userId for remote, or nickname for local
  gameState: Record<string, 'available' | 'answered'>; // key is questionId
  mysteryBoxEnabled: boolean;
  joinType: JoinType;
  createdAt: any;
  localPlayers?: LocalPlayer[];
}

    