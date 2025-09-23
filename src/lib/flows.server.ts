/**
 * @fileOverview Server-only module for all Genkit flows.
 * This file dynamically imports Genkit and its plugins to ensure
 * they are never included in the client bundle.
 */

import { z } from 'zod';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import type { GameRoom, Player, AnswerLog, Question, CorrectAnswer, IncorrectAnswer } from '@/lib/types';
import { ADMIN_EMAILS } from '@/lib/admins';

// Firestore Admin SDK Initialization
if (!getApps().length) {
  initializeApp();
}
const db = getFirestore();

let _ai: any = null;

// Lazy-loads and caches the Genkit AI instance
async function getAi() {
  if (_ai) return _ai;

  const { genkit } = await import('genkit');
  const { googleAI } = await import('@genkit-ai/googleai');

  _ai = genkit({
    plugins: [googleAI()],
    enableTracingAndMetrics: false,
  });

  return _ai;
}


// Schemas for Flows
const AdjustDifficultyInputSchema = z.object({
  studentId: z.string(),
  gameSetId: z.string(),
  questionId: z.string(),
  isCorrect: z.boolean(),
  pointsAwarded: z.number(),
  mysteryBoxEnabled: z.boolean(),
});
const AdjustDifficultyOutputSchema = z.object({
  adjustedPointsAwarded: z.number(),
  adjustedMysteryBoxEnabled: z.boolean(),
});

const CorrectAnswerSchema = z.object({
  gameSetTitle: z.string(),
  question: z.string(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
});
const IncorrectAnswerSchemaForAnalysis = z.object({
    gameSetTitle: z.string(),
    question: z.object({
      id: z.number().optional(),
      question: z.string(),
      points: z.number().optional(),
      type: z.enum(['subjective', 'multipleChoice', 'ox']).optional(),
      subject: z.string().optional(),
      unit: z.string().optional(),
    }),
});
const AnalyzeLearningInputSchema = z.object({
  correctAnswers: z.array(CorrectAnswerSchema),
  incorrectAnswers: z.array(IncorrectAnswerSchemaForAnalysis),
});
const AnalyzeLearningOutputSchema = z.object({
  strongAreas: z.string(),
  weakAreas: z.string(),
});

const CheckUserIdInputSchema = z.object({ userId: z.string() });
const CheckUserIdOutputSchema = z.object({
  exists: z.boolean(),
  nickname: z.string(),
  uid: z.string(),
});

const CheckReviewAnswerInputSchema = z.object({
  originalQuestion: z.any(),
  reviewQuestion: z.string(),
  userAnswer: z.string(),
});
const CheckReviewAnswerOutputSchema = z.object({
  isCorrect: z.boolean(),
  explanation: z.string(),
});

const GenerateReviewQuestionInputSchema = z.object({
  originalQuestion: z.any(),
});
const GenerateReviewQuestionOutputSchema = z.object({
  newQuestion: z.string(),
});

const PlayerSchema = z.object({
    uid: z.string(),
    nickname: z.string(),
    score: z.number(),
    avatarId: z.string(),
    isHost: z.boolean().optional(),
});
const JoinGameInputSchema = z.object({
  gameRoomId: z.string(),
  player: PlayerSchema,
});
const JoinGameOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const UpdateScoresInputSchema = z.object({
  gameRoomId: z.string(),
  players: z.array(PlayerSchema),
  totalQuestions: z.number(),
});
const UpdateScoresOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

const ValidateQuestionSchema = z.object({
  question: z.string(),
  answer: z.string().optional(),
  correctAnswer: z.string().optional(),
});
const ValidateQuizSetInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  grade: z.string().optional(),
  semester: z.string().optional(),
  subject: z.string().optional(),
  unit: z.string().optional(),
  questions: z.array(ValidateQuestionSchema),
});
const ValidateQuizSetOutputSchema = z.object({
  isValid: z.boolean(),
  reason: z.string(),
});


// Flow Implementations
const flows: Record<string, any> = {
    adjustDifficulty: async (input: z.infer<typeof AdjustDifficultyInputSchema>) => {
        const ai = await getAi();
        const { googleAI } = await import('@genkit-ai/googleai');
        const prompt = ai.definePrompt({
            name: 'adjustDifficultyPrompt',
            model: googleAI.model('gemini-1.5-flash'),
            input: {schema: AdjustDifficultyInputSchema},
            output: {schema: AdjustDifficultyOutputSchema},
            prompt: `You are an AI game master, tasked with dynamically adjusting the difficulty of a game for a student. Based on the student's performance, you will adjust the points awarded for the next question and whether or not to enable the mystery box feature. Student ID: {{{studentId}}}, Game Set ID: {{{gameSetId}}}, Question ID: {{{questionId}}}, Is Correct: {{{isCorrect}}}, Points Awarded: {{{pointsAwarded}}}, Mystery Box Enabled: {{{mysteryBoxEnabled}}}. If the student is performing well, slightly increase the points. If they are struggling, slightly decrease points and consider disabling mystery box. Return adjusted points and mystery box status. Ensure adjustments are reasonable.`,
        });
        const { output } = await prompt(input);
        return output;
    },
    analyzeLearning: async (input: z.infer<typeof AnalyzeLearningInputSchema>) => {
        const ai = await getAi();
        const { googleAI } = await import('@genkit-ai/googleai');
        const prompt = ai.definePrompt({
            name: 'analyzeLearningPrompt',
            model: googleAI.model('gemini-1.5-flash'),
            input: { schema: AnalyzeLearningInputSchema },
            output: { schema: AnalyzeLearningOutputSchema },
            prompt: `You are an expert learning analyst AI. Your task is to analyze a student's performance based on their correct and incorrect answers to identify their strong and weak areas. Analyze subjects, grades, and units. For "strongAreas", summarize topics the student understands well. For "weakAreas", summarize topics the student struggles with. Provide output as a short, bulleted summary for each category. If a list is empty, state that there is not enough data. Respond in Korean. Correct Answers: {{#each correctAnswers}}- Subject: {{this.subject}}, Unit: {{this.unit}}{{/each}}. Incorrect Answers: {{#each incorrectAnswers}}- Subject: {{this.question.subject}}, Unit: {{this.question.unit}}{{/each}}.`,
        });
        const { output } = await prompt(input);
        return output;
    },
    checkUserId: async ({ userId }: z.infer<typeof CheckUserIdInputSchema>) => {
        try {
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('email', '==', userId).limit(1).get();

            if (snapshot.empty) {
                 return { exists: false, nickname: '', uid: '' };
            }
            const userDoc = snapshot.docs[0];
            const userData = userDoc.data();
            const uid = userDoc.id;
            const nickname = userData.displayName || userId;
            return { exists: true, nickname: nickname, uid: uid };
        } catch(e: any) {
            console.error("Error in checkUserId flow:", e);
            if (e.code === 'FAILED_PRECONDITION' && e.message.includes('index')) {
                 throw new Error('Firestore index is missing. Please create a single-field index on the "email" field in the "users" collection.');
            }
            throw e;
        }
    },
    checkReviewAnswer: async (input: z.infer<typeof CheckReviewAnswerInputSchema>) => {
        const ai = await getAi();
        const { googleAI } = await import('@genkit-ai/googleai');
        const prompt = ai.definePrompt({
            name: 'checkReviewAnswerPrompt',
            model: googleAI.model('gemini-1.5-flash'),
            input: { schema: CheckReviewAnswerInputSchema },
            output: { schema: CheckReviewAnswerOutputSchema },
            prompt: `You are an AI grading assistant. Evaluate a student's answer to a review question for semantic correctness based on the original question's context. The answer doesn't need to be an exact match. Respond in Korean. Original Question: {{originalQuestion.question}}, Correct Answer: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}. Review Question Asked: {{{reviewQuestion}}}. Student's Answer: {{{userAnswer}}}. Is the student's answer semantically correct?`,
        });
        const { output } = await prompt(input);
        return output;
    },
    generateReviewQuestion: async (input: z.infer<typeof GenerateReviewQuestionInputSchema>) => {
        const ai = await getAi();
        const { googleAI } = await import('@genkit-ai/googleai');
        const prompt = ai.definePrompt({
            name: 'generateReviewQuestionPrompt',
            model: googleAI.model('gemini-1.5-flash'),
            input: { schema: GenerateReviewQuestionInputSchema },
            output: { schema: GenerateReviewQuestionOutputSchema },
            prompt: `You are an AI tutor. Create a new, similar but differently phrased review question based on a question a student previously answered incorrectly. It MUST be a subjective/descriptive question. The difficulty and vocabulary MUST be appropriate for the original question's grade level. Generate only the question text. Respond in Korean. Original Question Grade Level: {{originalQuestion.grade}}. {{#if originalQuestion.imageUrl}}The original question had an image (unavailable now), so create a question based on the correct answer keyword: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}.{{else}}Original Question: {{originalQuestion.question}}. Original Answer: {{#if originalQuestion.answer}}{{originalQuestion.answer}}{{else}}{{originalQuestion.correctAnswer}}{{/if}}.{{/if}}`,
        });
        const { output } = await prompt(input);
        return output;
    },
    joinGame: async ({ gameRoomId, player }: z.infer<typeof JoinGameInputSchema>) => {
        if (!gameRoomId || !player) throw new Error("Game room ID and player info are required.");
        const roomRef = db.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();
        if (!roomSnap.exists) return { success: false, message: '존재하지 않는 게임방입니다.' };

        const roomData = roomSnap.data() as GameRoom;
        if (roomData.joinType !== 'remote') return { success: true, message: '로컬 게임방입니다. 로비로 이동합니다.' };
        
        const playerUIDs = Object.keys(roomData.players || {});
        if (playerUIDs.includes(player.uid)) return { success: true, message: '이미 참여한 게임방입니다. 로비로 이동합니다.'};
        if (playerUIDs.length >= 6) return { success: false, message: '게임방이 가득 찼습니다.' };

        await roomRef.update({ [`players.${player.uid}`]: player });
        return { success: true, message: '게임에 참가했습니다. 로비로 이동합니다.' };
    },
    updateScores: async ({ gameRoomId, players, totalQuestions }: z.infer<typeof UpdateScoresInputSchema>) => {
        if (!gameRoomId || !players || players.length === 0) throw new Error("Game room ID and player scores are required.");

        const roomRef = db.collection('game-rooms').doc(gameRoomId);
        const roomSnap = await roomRef.get();
        if (!roomSnap.exists) throw new Error(`Game room ${gameRoomId} not found.`);
        
        const gameRoomData = roomSnap.data() as GameRoom;
        const answerLogs = gameRoomData.answerLogs || [];
        const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
        const totalPlayers = rankedPlayers.length;
        const batch = db.batch();

        const calculateTotalXp = (rank: number, totalPlayers: number, totalQuestions: number): number => {
            const rankRewardTable: Record<number, number[]> = { 2: [30, 10], 3: [50, 30, 10], 4: [70, 50, 20, 10], 5: [90, 60, 40, 20, 10], 6: [100, 70, 50, 30, 20, 10] };
            const rewards = rankRewardTable[totalPlayers] || rankRewardTable[6];
            const rankPoints = (rank > rewards.length) ? (rewards[rewards.length - 1] || 10) : rewards[rank - 1];
            return rankPoints + totalQuestions;
        };

        for (let i = 0; i < rankedPlayers.length; i++) {
            const player = rankedPlayers[i];
            if (player.uid) {
                const xpGained = calculateTotalXp(i + 1, totalPlayers, totalQuestions);
                const userRef = db.collection('users').doc(player.uid);
                batch.update(userRef, { xp: FieldValue.increment(xpGained), lastPlayed: Timestamp.now() });
            }
        }
        
        const removeUndefined = (obj: any) => {
            Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
            return obj;
        };

        for (const log of answerLogs) {
            if (!log.userId || !log.question) continue;
            const timestamp = (log.timestamp && !(log.timestamp instanceof Timestamp)) ? Timestamp.fromDate(new Date(log.timestamp as any)) : log.timestamp || Timestamp.now();
            if (log.isCorrect) {
                const correctAnswerRef = db.collection('users').doc(log.userId).collection('correct-answers').doc();
                batch.set(correctAnswerRef, removeUndefined({ gameSetId: log.gameSetId, gameSetTitle: log.gameSetTitle, question: log.question.question, grade: log.question.grade, semester: log.question.semester, subject: log.question.subject, unit: log.question.unit, timestamp: timestamp }));
            } else {
                const incorrectAnswerRef = db.collection('users').doc(log.userId).collection('incorrect-answers').doc();
                batch.set(incorrectAnswerRef, removeUndefined({ userId: log.userId, gameSetId: log.gameSetId, gameSetTitle: log.gameSetTitle, question: log.question, userAnswer: log.userAnswer, timestamp: timestamp }));
            }
        }
        
        await batch.commit();
        return { success: true, message: `Successfully updated XP and logs for ${players.length} players.` };
    },
    validateQuizSet: async (input: z.infer<typeof ValidateQuizSetInputSchema>) => {
        const ai = await getAi();
        const { googleAI } = await import('@genkit-ai/googleai');
        const prompt = ai.definePrompt({
            name: 'validateQuizSetPrompt',
            model: googleAI.model('gemini-1.5-flash'),
            input: { schema: ValidateQuizSetInputSchema },
            output: { schema: ValidateQuizSetOutputSchema },
            prompt: `You are an expert AI content moderator for an educational platform. Review a user-submitted quiz set for appropriateness and quality. Criteria: 1. No duplicate questions. 2. Educational, safe content (no profanity, abuse, or point farming). 3. Content relevant to metadata (grade, subject, unit). Data: Title: {{{title}}}, Desc: {{{description}}}, Grade: {{{grade}}}, Semester: {{{semester}}}, Subject: {{{subject}}}, Unit: {{{unit}}}. Questions: {{#each questions}}- Q: {{this.question}} / A: {{#if this.answer}}{{this.answer}}{{else}}{{this.correctAnswer}}{{/if}}{{/each}}. Set isValid=true if it meets all criteria. If not, set isValid=false and provide a clear, concise reason in Korean.`,
        });
        const { output } = await prompt(input);
        return output;
    }
};

export async function callGenkitFlow(flowName: string, input: any): Promise<any> {
    if (flows[flowName]) {
        try {
            return await flows[flowName](input);
        } catch (e: any) {
            console.error(`Error executing flow '${flowName}':`, e);
            throw new Error(`Server error during '${flowName}': ${e.message}`);
        }
    }
    throw new Error(`Flow '${flowName}' not found.`);
}
