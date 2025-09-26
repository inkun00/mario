
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { AnswerLog, Question } from '@/lib/types';

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    generationConfig: { responseMimeType: "application/json" }
});

interface ValidateQuizSetData {
    title: string;
    description?: string;
    grade?: string;
    semester?: string;
    subject?: string;
    unit?: string;
    questions: {
        question: string;
        answer?: string;
        correctAnswer?: string;
    }[];
}

interface AnalyzeLearningData {
    answerLogs: AnswerLog[];
}

interface GenerateReviewQuestionData {
    originalQuestion: Question;
}

interface CheckReviewAnswerData {
    originalQuestion: Question;
    reviewQuestion: string;
    userAnswer: string;
}

async function validateQuizSet(data: ValidateQuizSetData) {
  const prompt = `당신은 교육용 플랫폼의 전문 AI 콘텐츠 검수관입니다. 사용자가 제출한 퀴즈 세트가 아래 기준을 모두 만족하는지 검토해 주세요.

  **검증 기준:**
  1.  **교육적 적합성 및 안전성:** 모든 질문과 답변은 교육적이어야 하며, 모든 연령대에 안전해야 합니다. 비속어, 모욕적인 내용, 또는 폭력적이거나 부적절한 콘텐츠가 포함되어서는 안 됩니다.
  2.  **성의 없는 콘텐츠 방지 (치팅/포인트 파밍 방지):** "문제1", "정답1", "asdf" 와 같이 의미 없이 점수 획득만을 목적으로 생성된 것으로 보이는 성의 없는 질문이나 답변이 있는지 확인합니다.
  3.  **내용의 관련성:** 질문들이 명시된 학년, 과목, 단원의 주제와 관련이 있는지 확인합니다.
  4.  **중복 질문:** 완전히 동일하거나 거의 유사한 질문이 반복되는지 확인합니다.

  **제출된 퀴즈 데이터:**
  - 제목: ${data.title}
  - 설명: ${data.description}
  - 학년: ${data.grade}
  - 학기: ${data.semester}
  - 과목: ${data.subject}
  - 단원: ${data.unit}
  - 질문 목록:
    ${data.questions.map(q => `- 질문: ${q.question} / 답변: ${q.answer || q.correctAnswer}`).join('\n')}

  **출력 형식:**
  검토 결과를 바탕으로, "isValid" (boolean)와 "reason" (string) 키를 가진 JSON 객체로만 응답해 주세요.
  - 모든 기준을 통과하면 "isValid"를 true로 설정하고, "reason"은 비워둡니다.
  - 하나라도 기준을 통과하지 못하면 "isValid"를 false로 설정하고, "reason"에 사용자가 무엇을 수정해야 하는지 한국어로 명확하고 간결하게 설명해 주세요.
  `;
  
  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}

async function analyzeLearning(data: AnalyzeLearningData) {
    const prompt = `You are an expert learning analyst AI. Your task is to analyze a student's performance based on their answer logs. Identify patterns to determine their strong and weak areas.

- Analyze the subjects, grades, and units from the lists of correct and incorrect answers.
- For "strongAreas", summarize which topics the student seems to understand well (based on 'isCorrect: true').
- For "weakAreas", summarize which topics the student is struggling with (based on 'isCorrect: false').
- Provide the output as a short, easy-to-read summary for each category. Use bullet points and simple HTML like <ul> and <li>.
- If the log is empty, state that there is not enough data to analyze.
- Respond in Korean.
- Your entire response should be a single JSON object with keys "strongAreas" and "weakAreas".

Answer Logs:
${data.answerLogs.map(log => `- Subject: ${log.question.subject || 'N/A'}, Unit: ${log.question.unit || 'N/A'}, Correct: ${log.isCorrect}`).join('\n')}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}

async function generateReviewQuestion(data: GenerateReviewQuestionData) {
    const { originalQuestion } = data;
    const prompt = `You are an AI tutor. Your task is to create a review question based on a question a student previously answered incorrectly.
  The new question must be related to the original one but phrased differently.
  It MUST be a subjective/descriptive question that requires a written answer, not multiple choice or O/X.
  Most importantly, the difficulty and vocabulary of the new question MUST be appropriate for the original question's grade level.
  Respond with a JSON object containing a single key "newQuestion".
  Respond in Korean.

  Original Question Grade Level: ${originalQuestion.grade}

  ${originalQuestion.imageUrl 
    ? `The original question included an image, which is not available now. Therefore, create a new descriptive question based on the original question's correct answer keyword.
  Original Question's Correct Answer: ${originalQuestion.answer || originalQuestion.correctAnswer}`
    : `Original Question: ${originalQuestion.question}
  Original Answer: ${originalQuestion.answer || originalQuestion.correctAnswer}`
  }
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}

async function checkReviewAnswer(data: CheckReviewAnswerData) {
    const { originalQuestion, reviewQuestion, userAnswer } = data;
    const prompt = `You are an AI grading assistant. Your task is to evaluate a student's answer to a review question.
  The answer doesn't have to be an exact match, but it must be semantically correct.
  Base your evaluation on the context of the original question and its answer.
  Respond with a JSON object with keys "isCorrect" (boolean) and "explanation" (string).
  The explanation should be a brief reason for why the answer is correct or incorrect.
  Respond in Korean.

  Original Question: ${originalQuestion.question}
  Correct Answer to Original Question: ${originalQuestion.answer || originalQuestion.correctAnswer}

  Review Question Asked: ${reviewQuestion}
  Student's Answer: ${userAnswer}

  Is the student's answer semantically correct based on the original question's context?
  `;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}


export async function POST(req: NextRequest) {
  try {
    const { action, data } = await req.json();

    let result;
    switch (action) {
      case 'validateQuizSet':
        result = await validateQuizSet(data);
        break;
      case 'analyzeLearning':
        result = await analyzeLearning(data);
        break;
      case 'generateReviewQuestion':
        result = await generateReviewQuestion(data);
        break;
      case 'checkReviewAnswer':
        result = await checkReviewAnswer(data);
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: 'An error occurred while processing the AI request.' }, { status: 500 });
  }
}
