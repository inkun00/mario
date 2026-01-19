import { Timestamp } from 'firebase/firestore';

export type PointAcquisitionRule = 'teacher_only' | 'class_only' | 'all';

export type PointLogType = 
  | 'QUIZ_REWARD'      // 퀴즈 풀고 보상
  | 'REVIEW_REWARD'    // 오답노트 복습 보상
  | 'ITEM_PURCHASE'    // 아이템 구매 (포인트 차감)
  | 'ITEM_SALE'        // 아이템 판매 (포인트 획득)
  | 'ITEM_REFUND_BUYER'// 아이템 환불 (구매자 포인트 환급)
  | 'ITEM_REFUND_SELLER'// 아이템 판매 취소에 따른 환불 (판매자 포인트 차감)
  | 'ITEM_SALE_REFUND' // 판매된 아이템이 환불됨 (판매자 포인트 차감)
  | 'SEND_POINTS'      // 포인트 보내기 (차감)
  | 'RECEIVE_POINTS'   // 포인트 받기 (획득)
  | 'TEACHER_GRANT'    // 교사 지급
  | 'TEACHER_DEDUCT'  // 교사 회수
  | 'ITEM_USE'         // 아이템 사용
  | 'ITEM_GIFT_SEND'   // 아이템 선물
  | 'ITEM_GIFT_RECEIVE'; // 아이템 받음


export interface PointLog {
  id: string;
  userId: string;
  type: PointLogType;
  amount: number; // 양수는 획득, 음수는 사용
  timestamp: any;
  description: string; // 예: "숙제 면제권 구매", "'사회 퀴즈' 완료", "김땡땡에게 보내기"
  relatedUserId?: string; // 예: 포인트를 보내거나 받은 상대방 ID
  relatedItemId?: string; // 예: 구매/판매한 아이템 ID
  relatedQuestion?: Question; // 퀴즈 보상과 관련된 질문 정보
}

export interface User {
  uid: string;
  email: string | null;
  name?: string; // Real name
  displayName: string; // Nickname
  xp: number;
  classPoints?: number;
  level: number;
  lastPlayed?: any;
  schoolName?: string;
  grade?: string;
  class?: string;
  dailyReportCount?: number;
  lastReportDate?: any;
  role?: 'student' | 'teacher';
  classId?: string; // 학생이 속한 학급 코드
  classCode?: string; // 교사가 생성한 학급 코드
  inventory?: {
    [itemId: string]: {
      name: string;
      itemId: string; // The original document ID from class-store-items
      quantity: number;
      description?: string;
      sellerId?: string; // 판매자 ID
      sellerNickname?: string; // 판매자 닉네임
      price?: number; // 구매 당시 가격
      emoji?: string;
    }
  };
  pixelAvatar?: string; // JSON string of string[][]
  pointAcquisitionRule?: PointAcquisitionRule;
  lastWritingSubmission?: any;
}

export interface Question {
  id: number;
  question: string;
  points: number;
  type: 'subjective' | 'multipleChoice' | 'ox';
  mcqOptionCount?: 4 | 5;
  imageUrl?: string;
  hint?: string;
  // for subjective
  answer?: string;
  // for multiple choice or ox
  options?: string[];
  correctAnswer?: string;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
}

export interface GameSetComment {
  id: string;
  userId: string;
  userNickname: string;
  userAvatar: string | null;
  comment: string;
  createdAt: Timestamp;
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
  playCount?: number;
  likeCount?: number;
  commentCount?: number;
  likedBy?: string[];
  reportCount?: number;
  isDisabled?: boolean;
  reportedBy?: string[];
  oppositionCount?: number;
  evaluationScore?: number;
}

export interface Player {
  uid: string;
  nickname:string;
  score: number;
  pixelAvatar?: string;
  isHost?: boolean;
}

export type JoinType = 'remote' | 'local';

export interface LocalPlayer {
    userId: string;
    confirmed: boolean;
}

export type MysteryEffectType = 'bonus' | 'double' | 'penalty' | 'half' | 'swap';

export interface MysteryEffect {
    type: MysteryEffectType;
    title: string;
    description: string;
    value?: number;
}

export interface AnswerLog {
    id: string; // Unique ID for each log entry
    userId: string;
    question: Question;
    userAnswer: string;
    isCorrect: boolean;
    pointsAwarded: number;
    timestamp: any; // Can be Date for client, converted to Timestamp for server
}

export interface AnswerResult {
    isCorrect: boolean;
    userAnswer: string;
    correctAnswer: string;
    pointsAwarded: number;
}


export interface GameRoom {
  id: string;
  roomTitle: string;
  gameSetId: string;
  password?: string;
  status: 'waiting' | 'setting-mystery' | 'playing' | 'finished';
  hostId: string;
  currentTurn: string; // userId or nickname for local
  players: Record<string, Player>; // key is userId for remote, or nickname for local
  playerUIDs?: string[]; // ordered list of player UIDIDs for turn sequence
  gameState: Record<string, 'available' | 'flipping' | 'answered'>; // key is questionId
  mysteryBoxEnabled: boolean;
  isMysterySettingDone: boolean;
  enabledMysteryEffects?: MysteryEffectType[];
  mysteryEffectVotes?: Record<string, string[]>; // key: effectType, value: array of player uids
  joinType: JoinType;
  createdAt: Timestamp;
  timeLimit?: number; // in seconds, 0 for unlimited
  questionStartTime?: Timestamp;
  localPlayers?: LocalPlayer[];
  answerLogs?: AnswerLog[];
  gameStartedAt?: any;
  currentAnswerResult?: AnswerResult | null;
  currentMysteryEffect?: MysteryEffect | null;
  joinRequests?: string[];
  bonusPoints?: Record<string, number>; // Key: userId, Value: total bonus points
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
    userId: string;
    question: Question;
    userAnswer: string;
    timestamp: any;
}

export interface SolvedIncorrectAnswer extends IncorrectAnswer {
  reviewAnswer: string;
  wasReviewCorrect: boolean;
  reviewedAt: any;
}


export interface PlayedGameSet {
  gameSetId: string;
  playedAt: any; // Firestore Timestamp
  gameRoomId: string;
}

export interface FinishGamePayload {
    gameRoomId: string;
    answerLogs: AnswerLog[];
}

export interface SubjectStat {
    id: string; // subject name
    totalCorrect: number;
    totalIncorrect: number;

    units: {
        [unitName: string]: {
            totalCorrect: number;
            totalIncorrect: number;
        };
    };
    [key: string]: any;
}

export interface School {
  name: string;
  totalXp: number;
  memberCount: number;
  members: User[];
}

export interface ItemReport {
  reporterId: string;
  reporterName: string;
  reason: string;
  reportedAt: any;
}

export interface ClassStoreItem {
  id: string; // document id
  sellerId: string; // user.uid
  sellerName: string; // user.name
  sellerNickname: string; // user.displayName
  classId: string; // The class this item belongs to
  name: string;
  price: number;
  description: string;
  quantity: number;
  emoji?: string;
  createdAt: any; // serverTimestamp
  report?: ItemReport | null;
}

export interface ItemBuyer {
    uid: string;
    name: string;
    quantity: number;
}

export interface EvaluateWritingOutput {
  score: number;
  contentFeedback: string;
  organizationFeedback: string;
  expressionFeedback: string;
  finalFeedback: string;
  correctedText: string;
}

export interface WritingSubmission {
  id: string;
  topic: string;
  prompt: string;
  response: string;
  evaluation: EvaluateWritingOutput;
  createdAt: any;
}

export interface SurvivalPlayer extends Player {
  isEliminated: boolean;
  eliminatedAtQuestion?: number; // question index when eliminated
  answers: {
    questionId: number;
    isCorrect: boolean;
    submittedAt: Timestamp;
    points: number;
  }[];
}

export interface SurvivalGameRoom {
    id: string;
    roomTitle: string;
    hostId: string;
    status: 'waiting' | 'playing' | 'finished';
    createdAt: Timestamp;
    
    // Game Settings
    gameSetIds: string[];
    allQuestions: Question[]; // All questions from all sets, shuffled
    timeLimitPerQuestion: number; // in seconds
    revivalEnabled: boolean;
    revivalPercentage: number; // 0-100
    participationScope: 'class' | 'public';

    // Game State
    players: Record<string, SurvivalPlayer>;
    playerUIDs: string[];
    currentQuestionIndex: number;
    currentQuestionStartedAt?: Timestamp;
    currentQuestionEndsAt?: Timestamp;
    isAnswerRevealed: boolean;
    eliminatedPlayerIds: string[];
    revivalHappened: boolean;
    currentAnswers?: Record<string, {
        answer: string;
        submittedAt: Timestamp;
    }>;
    lastQuestionResults?: Record<string, {
        isCorrect: boolean;
        points: number;
    }>;
}


export interface Team {
  id: 'teamA' | 'teamB';
  name: string;
  score: number;
}

export interface TeamBattlePlayer extends SurvivalPlayer {
  teamId?: 'teamA' | 'teamB';
  questionOrder?: number[];
  currentQuestionIndex?: number;
}

export interface TeamBattleGameRoom {
  id: string;
  roomTitle: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Timestamp;
  gameSetIds: string[];
  allQuestions: Question[];
  teamAssignment: 'manual' | 'random';
  players: Record<string, TeamBattlePlayer>;
  teams: {
      teamA: Team;
      teamB: Team;
  };
  gameDuration?: number; // in minutes
  gameStartedAt?: Timestamp;
  gameEndTime?: Timestamp;
  currentQuestionStartedAt?: Timestamp;
  isAnswerRevealed?: boolean;
  currentAnswers?: Record<string, {
      answer: string;
      submittedAt: Timestamp;
  }>;
  lastQuestionResults?: Record<string, {
      isCorrect: boolean;
      points: number;
  }>;
}

export interface TeamCooperationPlayer extends Player {
    answers: {
        questionId: number;
        isCorrect: boolean;
        submittedAt: Timestamp;
        points: number;
    }[];
}

export interface TeamCooperationGameRoom {
  id: string;
  roomTitle: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Timestamp;
  gameSetIds: string[];
  allQuestions: Question[];

  // Mission
  targetScore: number;
  
  // Game State
  players: Record<string, TeamCooperationPlayer>;
  teamScore: number;
  currentQuestionIndex: number;
  currentQuestionStartedAt?: Timestamp;
  isAnswerRevealed?: boolean;
  currentAnswers?: Record<string, {
      answer: string;
      submittedAt: Timestamp;
  }>;
  lastQuestionResults?: Record<string, {
      isCorrect: boolean;
      points: number;
  }>;
}
