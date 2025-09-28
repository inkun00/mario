
'use server';
/**
 * @fileOverview Defines AI flows for quiz management using Genkit.
 *
 * - validateQuizSet: Validates a user-submitted quiz set.
 * - analyzeLearning: Analyzes a student's learning patterns.
 * - generateReviewQuestion: Generates a new review question based on an incorrect answer.
 * - checkReviewAnswer: Checks a student's answer to a review question.
 */

import {ai} from '@/ai/genkit';
import {
  QuizSetValidationData,
  LearningAnalysisData,
  ReviewQuestionData,
  CheckReviewAnswerData,
} from '@/lib/types';
import {
  ValidationOutputSchema,
  AnalysisOutputSchema,
  ReviewQuestionOutputSchema,
  CheckReviewAnswerOutputSchema,
  QuizSetValidationInputSchema,
  LearningAnalysisInputSchema,
  ReviewQuestionInputSchema,
  CheckReviewAnswerInputSchema
} from '@/lib/schemas';


// 1. Flow for Validating Quiz Sets

const validateQuizSetPrompt = ai.definePrompt({
  name: 'validateQuizSetPrompt',
  input: {schema: QuizSetValidationInputSchema},
  output: {schema: ValidationOutputSchema},
  config: {model: 'gemini-2.0-flash-latest'},
  prompt: `당신은 교육용 플랫폼의 전문 AI 콘텐츠 검수관입니다. 사용자가 제출한 퀴즈 세트가 아래 기준을 모두 만족하는지 검토해 주세요.

    **검증 기준:**
    1.  **교육적 적합성 및 안전성:** 모든 질문과 답변은 교육적이어야 하며, 모든 연령대에 안전해야 합니다. 비속어, 모욕적인 내용, 또는 폭력적이거나 부적절한 콘텐츠가 포함되어서는 안 됩니다.
    2.  **성의 없는 콘텐츠 방지 (치팅/포인트 파밍 방지):** "문제1", "정답1", "asdf" 와 같이 의미 없이 점수 획득만을 목적으로 생성된 것으로 보이는 성의 없는 질문이나 답변이 있는지 확인합니다.
    3.  **내용의 관련성:** 질문들이 명시된 학년, 과목, 단원의 주제와 관련이 있는지 확인합니다.
    4.  **중복 질문:** 완전히 동일하거나 거의 유사한 질문이 반복되는지 확인합니다.

    **제출된 퀴즈 데이터:**
    - 제목: ${"{{title}}"}
    - 설명: ${"{{description}}"}
    - 학년: ${"{{grade}}"}
    - 학기: ${"{{semester}}"}
    - 과목: ${"{{subject}}"}
    - 단원: ${"{{unit}}"}
    - 질문 목록:
      {{#each questions}}- 질문: {{question}} / 답변: {{answer}}{{correctAnswer}}
      {{/each}}

    **출력 형식:**
    검토 결과를 바탕으로, "isValid" (boolean)와 "reason" (string) 키를 가진 JSON 객체로만 응답해 주세요.
    - 모든 기준을 통과하면 "isValid"를 true로 설정하고, "reason"은 비워둡니다.
    - 하나라도 기준을 통과하지 못하면 "isValid"를 false로 설정하고, "reason"에 사용자가 무엇을 수정해야 하는지 한국어로 명확하고 간결하게 설명해 주세요.
    Your response must be a valid JSON object.`,
});

const validateQuizSetFlow = ai.defineFlow(
  {
    name: 'validateQuizSetFlow',
    inputSchema: QuizSetValidationInputSchema,
    outputSchema: ValidationOutputSchema,
  },
  async input => {
    const {output} = await validateQuizSetPrompt(input);
    return output!;
  }
);

export async function validateQuizSet(input: QuizSetValidationData) {
    return await validateQuizSetFlow(input);
}


// 2. Flow for Analyzing Learning

const analyzeLearningPrompt = ai.definePrompt({
    name: 'analyzeLearningPrompt',
    input: { schema: LearningAnalysisInputSchema },
    output: { schema: AnalysisOutputSchema },
    config: {model: 'gemini-2.0-flash-latest'},
    prompt: `You are an expert learning analyst AI. Your task is to analyze a student's performance based on their answer logs. Identify patterns to determine their strong and weak areas.

    - Analyze the topics from the list of questions.
    - For "strongAreas", summarize which topics the student seems to understand well (based on 'isCorrect: true').
    - For "weakAreas", summarize which topics the student is struggling with (based on 'isCorrect: false').
    - Provide the output as a short, easy-to-read summary for each category. Use bullet points and simple HTML like <ul> and <li>.
    - If the log is empty, state that there is not enough data to analyze.
    - Respond in Korean.
    - Your entire response should be a single JSON object with keys "strongAreas" and "weakAreas".

    Answer Logs:
    {{#each answerLogs}}- Question: {{question}}, Correct: {{isCorrect}}
    {{/each}}
    
    Your response must be a valid JSON object.`
});

const analyzeLearningFlow = ai.defineFlow(
    {
        name: 'analyzeLearningFlow',
        inputSchema: LearningAnalysisInputSchema,
        outputSchema: AnalysisOutputSchema,
    },
    async (input) => {
        const { output } = await analyzeLearningPrompt(input);
        return output!;
    }
);

export async function analyzeLearning(input: LearningAnalysisData) {
    return await analyzeLearningFlow(input);
}


// 3. Flow for Generating Review Questions

const generateReviewQuestionPrompt = ai.definePrompt({
    name: 'generateReviewQuestionPrompt',
    input: { schema: ReviewQuestionInputSchema },
    output: { schema: ReviewQuestionOutputSchema },
    config: {model: 'gemini-2.0-flash-latest'},
    prompt: `You are an AI tutor. Your task is to create a review question based on a question a student previously answered incorrectly.
    The new question must be related to the original one but phrased differently.
    It MUST be a subjective/descriptive question that requires a written answer, not multiple choice or O/X.
    Most importantly, the difficulty and vocabulary of the new question MUST be appropriate for the original question's grade level and unit.
    Respond with a JSON object containing a single key "newQuestion".
    Respond in Korean.

    Context:
    - Grade Level: ${"{{grade}}"}
    - Unit: ${"{{unit}}"}
    
    Original Question and Answer:
    - Question: ${"{{question}}"}
    - Answer: ${"{{answer}}"}

    Your response must be a valid JSON object.`
});

const generateReviewQuestionFlow = ai.defineFlow(
    {
        name: 'generateReviewQuestionFlow',
        inputSchema: ReviewQuestionInputSchema,
        outputSchema: ReviewQuestionOutputSchema,
    },
    async (input) => {
        const { output } = await generateReviewQuestionPrompt(input);
        return output!;
    }
);

export async function generateReviewQuestion(input: ReviewQuestionData) {
    return await generateReviewQuestionFlow(input);
}


// 4. Flow for Checking Review Answers

const checkReviewAnswerPrompt = ai.definePrompt({
    name: 'checkReviewAnswerPrompt',
    input: { schema: CheckReviewAnswerInputSchema },
    output: { schema: CheckReviewAnswerOutputSchema },
    config: {model: 'gemini-2.0-flash-latest'},
    prompt: `You are an AI grading assistant. Your task is to evaluate a student's answer to a review question.
    The answer doesn't have to be an exact match, but it must be semantically correct.
    Base your evaluation on the context of the original question and its answer.
    Respond with a JSON object with keys "isCorrect" (boolean) and "explanation" (string).
    The explanation should be a brief reason for why the answer is correct or incorrect.
    Respond in Korean.

    Original Question: ${"{{originalQuestion.question}}"}
    Correct Answer to Original Question: ${"{{originalQuestion.answer}}{{originalQuestion.correctAnswer}}"}

    Review Question Asked: ${"{{reviewQuestion}}"}
    Student's Answer: ${"{{userAnswer}}"}

    Is the student's answer semantically correct based on the original question's context?
    Your response must be a valid JSON object.`
});

const checkReviewAnswerFlow = ai.defineFlow(
    {
        name: 'checkReviewAnswerFlow',
        inputSchema: CheckReviewAnswerInputSchema,
        outputSchema: CheckReviewAnswerOutputSchema,
    },
    async (input) => {
        const { output } = await checkReviewAnswerPrompt(input);
        return output!;
    }
);

export async function checkReviewAnswer(input: CheckReviewAnswerData) {
    return await checkReviewAnswerFlow(input);
}
