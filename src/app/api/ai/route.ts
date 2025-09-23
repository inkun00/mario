import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import type { CorrectAnswer, IncorrectAnswer, Question } from '@/lib/types';

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
    correctAnswers: CorrectAnswer[];
    incorrectAnswers: IncorrectAnswer[];
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
  const prompt = `You are an expert AI content moderator for an educational platform. Your task is to review a user-submitted quiz set to ensure it is appropriate and high-quality.

  Please validate the quiz set based on the following criteria:
  1.  **No Duplicate Questions:** Check if there are any identical or nearly identical questions in the set.
  2.  **Educational and Safe Content:** Ensure all questions and answers are educational, safe for all ages, and not profane, abusive, or designed for cheating/point farming (e.g., "문제1", "정답1").
  3.  **Content Relevance:** Verify that the questions are relevant to the specified grade, subject, and unit. The content should match the provided metadata.

  Here is the quiz set data:
  - Title: ${data.title}
  - Description: ${data.description}
  - Grade: ${data.grade}
  - Semester: ${data.semester}
  - Subject: ${data.subject}
  - Unit: ${data.unit}
  - Questions:
    ${data.questions.map(q => `- Q: ${q.question} / A: ${q.answer || q.correctAnswer}`).join('\n')}

  Based on your review, respond with a JSON object with "isValid" (boolean) and a "reason" (string).
  If it fails any criterion, set "isValid" to false and provide a clear, concise, user-friendly "reason" in Korean explaining what the user needs to fix. If valid, "reason" can be empty.
  `;
  
  const result = await model.generateContent(prompt);
  const response = result.response;
  return JSON.parse(response.text());
}

async function analyzeLearning(data: AnalyzeLearningData) {
    const prompt = `You are an expert learning analyst AI. Your task is to analyze a student's performance based on their correct and incorrect answers. Identify patterns to determine their strong and weak areas.

  - Analyze the subjects, grades, and units from the lists of correct and incorrect answers.
  - For "strongAreas", summarize which topics the student seems to understand well.
  - For "weakAreas", summarize which topics the student is struggling with.
  - Provide the output as a short, easy-to-read summary for each category. Use bullet points and simple HTML like <ul> and <li>.
  - If a list is empty, state that there is not enough data to analyze.
  - Respond in Korean.
  - Your entire response should be a single JSON object with keys "strongAreas" and "weakAreas".

  Correct Answers:
  ${data.correctAnswers.map(c => `- Subject: ${c.subject}, Unit: ${c.unit}`).join('\n')}

  Incorrect Answers:
  ${data.incorrectAnswers.map(i => `- Subject: ${i.question.subject}, Unit: ${i.question.unit}`).join('\n')}
  `;

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
