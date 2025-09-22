

export interface User {
  uid: string;
  email: string | null;
  nickname: string;
  xp: number;
  level: number;
  lastPlayed?: any;
}

export interface Question {
  id: number;
  question: string;
  points: number;
  type: 'subjective' | 'multipleChoice' | 'ox';
  imageUrl?: string;
  hint?: string;
  // for subjective
  answer?: string;
  // for multiple choice or ox
  options?: string[];
  correctAnswer?: string;
  subject?: string;
  unit?: string;
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

export type MysteryEffectType = 'bonus' | 'double' | 'penalty' | 'half' | 'swap';

export interface AnswerLog {
    userId: string;
    gameSetId: string;
    gameSetTitle: string;
    question: Question;
    userAnswer?: string;
    isCorrect: boolean;
    pointsAwarded: number;
    timestamp?: any;
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
  isMysterySettingDone?: boolean;
  enabledMysteryEffects?: MysteryEffectType[];
  joinType: JoinType;
  createdAt: any;
  localPlayers?: LocalPlayer[];
  answerLogs?: AnswerLog[];
}

export interface CorrectAnswer {
    id: string;
    gameSetId: string;
    gameSetTitle: string;
    question: string;
    timestamp: any;
    grade?: string;
    semester?: string;
    subject?: string;
    unit?: string;
}

export interface IncorrectAnswer {
    id: string;
    gameSetId: string;
    gameSetTitle: string;
    question: Question;
    userAnswer: string;
    timestamp: any;
}
