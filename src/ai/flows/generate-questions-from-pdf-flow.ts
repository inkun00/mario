'use server';
/**
 * @fileOverview A Genkit flow for generating quiz questions from a PDF file.
 *
 * - generateQuestionsFromPdf: A function that handles the PDF analysis and question generation process.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the schema for a single generated question
const GeneratedQuestionSchema = z.object({
  question: z.string().describe('The generated question text.'),
  points: z.coerce.number().describe('A score for the question, from 10 to 50.'),
  type: z.enum(['subjective', 'multipleChoice', 'ox']).describe('The type of the question.'),
  imageUrl: z.string().optional().describe('URL for an optional image related to the question.'),
  hint: z.string().optional().describe('An optional hint for the question.'),
  answer: z.string().optional().describe('The answer for subjective questions.'),
  options: z.array(z.string()).optional().describe('A list of 4 options for multiple-choice questions.'),
  correctAnswer: z.string().optional().describe('The correct answer for multiple-choice or O/X questions.'),
});

// Define the input schema for the flow
const PdfQuestionGenerationInputSchema = z.object({
  pdfDataUri: z.string().describe("The PDF file content as a data URI (must be Base64 encoded: 'data:application/pdf;base64,...')."),
  grade: z.string().optional().describe('The target grade level for the questions.'),
  subject: z.string().optional().describe('The subject of the questions.'),
  unit: z.string().optional().describe('The specific unit or topic for the questions.'),
});
export type PdfQuestionGenerationInput = z.infer<typeof PdfQuestionGenerationInputSchema>;

// Define the output schema for the flow
const PdfQuestionGenerationOutputSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).describe('An array of generated quiz questions.'),
  title: z.string().optional().describe('A suitable title for the quiz set based on the document content.'),
  grade: z.string().optional().describe('The grade level identified from the document (e.g., "5학년").'),
  semester: z.string().optional().describe('The semester identified from the document (e.g., "1학기").'),
  subject: z.string().optional().describe('The subject identified from the document (e.g., "사회").'),
  unit: z.string().optional().describe('The unit or chapter title identified from the document.'),
});
export type PdfQuestionGenerationOutput = z.infer<typeof PdfQuestionGenerationOutputSchema>;

// Exported wrapper function to be called from the client
export async function generateQuestionsFromPdf(
  input: PdfQuestionGenerationInput
): Promise<PdfQuestionGenerationOutput> {
  const result = await generateQuestionsFlow(input);
  return result;
}

// Define the Genkit prompt
const generateQuestionsPrompt = ai.definePrompt({
  name: 'generateQuestionsFromPdfPrompt',
  input: { schema: PdfQuestionGenerationInputSchema },
  output: { schema: PdfQuestionGenerationOutputSchema },
  model: 'googleai/gemini-3.1-flash-lite-preview',
  prompt: `You are an expert educator in South Korea specializing in creating quiz content for students.
Your task is to analyze the provided PDF document and generate a set of at least 5-10 diverse and high-quality quiz questions based on its content. You must also extract metadata about the quiz.

Context for the quiz (use if provided, otherwise infer from the document):
- Grade: {{grade}}
- Subject: {{subject}}
- Unit: {{unit}}

Please adhere to the following instructions:
1.  **Analyze the Document**: Thoroughly review the content of the PDF provided.
    - PDF Document: {{media url=pdfDataUri}}
2.  **Extract Metadata**: From the document's content, identify and extract the following information. If it's not explicitly mentioned, leave the field blank.
    - A suitable \`title\` for the quiz set.
    - The \`grade\` (e.g., "5학년").
    - The \`semester\` (e.g., "1학기", "2학기").
    - The \`subject\` (e.g., "국어", "수학", "사회").
    - The \`unit\` or chapter title.
3.  **Language**: All generated content (title, questions, options, answers, hints, metadata) MUST be written in Korean.
4.  **Generate Diverse Questions**: Create a mix of question types ('subjective', 'multipleChoice', 'ox').
5.  **Content Requirements**:
    - For 'multipleChoice' questions, you MUST provide exactly 4 unique options.
    - For 'subjective' questions, provide a clear and concise answer.
    - For 'ox' questions, the correctAnswer must be either "O" or "X".
6.  **Assign Points**: Assign a point value between 10 and 50 for each question based on its difficulty.
7.  **Hints**: Provide a helpful but not-too-obvious hint for some of the more difficult questions.
8.  **Ensure Accuracy**: All questions, options, and answers must be factually correct based on the PDF content.

Generate the questions and metadata, then format the output according to the specified JSON schema.
`,
});

// Define the Genkit flow
const generateQuestionsFlow = ai.defineFlow(
  {
    name: 'generateQuestionsFromPdfFlow',
    inputSchema: PdfQuestionGenerationInputSchema,
    outputSchema: PdfQuestionGenerationOutputSchema,
  },
  async (input) => {
    const { output } = await generateQuestionsPrompt(input);
    if (!output) {
      throw new Error('Failed to generate questions from the PDF.');
    }
    return output;
  }
);
