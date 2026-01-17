'use server';
/**
 * @fileOverview A Genkit flow for evaluating a student's descriptive writing submission.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define input schema
const EvaluateWritingInputSchema = z.object({
  prompt: z.string().describe("The original writing prompt given to the student."),
  userResponse: z.string().describe("The student's written response."),
  topic: z.string().describe("The general topic of the prompt to provide context (e.g., 'Science / Gases')."),
});
export type EvaluateWritingInput = z.infer<typeof EvaluateWritingInputSchema>;

// Define output schema
const EvaluateWritingOutputSchema = z.object({
  score: z.number().min(0).max(100).describe('The overall score from 0 to 100 based on the rubric.'),
  contentFeedback: z.string().describe("Detailed feedback on content validity based on the rubric."),
  organizationFeedback: z.string().describe("Detailed feedback on logical structure based on the rubric."),
  expressionFeedback: z.string().describe("Detailed feedback on appropriateness of expression, including spelling and vocabulary."),
  finalFeedback: z.string().describe("A final, encouraging summary of the evaluation."),
  correctedText: z.string().describe("The student's original text with spelling and grammatical corrections applied."),
});
export type EvaluateWritingOutput = z.infer<typeof EvaluateWritingOutputSchema>;

export async function evaluateWriting(input: EvaluateWritingInput): Promise<EvaluateWritingOutput> {
  return evaluateWritingFlow(input);
}

const evaluateWritingPrompt = ai.definePrompt({
  name: 'evaluateWritingPrompt',
  input: { schema: EvaluateWritingInputSchema },
  output: { schema: EvaluateWritingOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are an AI assistant for evaluating elementary school students' descriptive writing in Korean.
Your task is to score the student's response based on the provided prompt and a detailed rubric, and provide constructive feedback.

**Topic:** {{topic}}
**Writing Prompt:** {{prompt}}
**Student's Response:**
---
{{userResponse}}
---

**Evaluation Rubric:**
1.  **Content Validity (40 points):** Evaluate if the response accurately addresses the prompt, includes key information (keywords), is factually correct, and meets all stated conditions (e.g., "list two reasons").
2.  **Logical Structure (30 points):** Assess if the writing is well-organized, with clear cause-and-effect relationships and complete, coherent sentences (subject-verb agreement, punctuation).
3.  **Appropriateness of Expression (30 points):** Check for correct spelling and spacing appropriate for the student's level. Also, evaluate the use of relevant vocabulary learned in the unit. For spelling/grammar, provide corrections rather than just penalizing.

**Scoring Guide:**
- **Excellent (90-100):** Meets all criteria excellently. Key concepts are included, logical, and error-free.
- **Good (70-89):** Core concepts included, but structure or expression could be slightly improved. Minor errors.
- **Needs Effort (40-69):** Contains key concepts but has significant errors in explanation, structure, or expression. Some misconceptions may be present.
- **Insufficient (0-39):** Off-topic, doesn't understand the prompt, or is missing core concepts.

**Your Task:**
Provide a detailed evaluation in JSON format.
- Give a score between 0 and 100.
- Provide specific, encouraging feedback for each of the three rubric categories (Content, Organization, Expression).
- Write a final, encouraging summary of the evaluation.
- Provide a corrected version of the student's text, fixing spelling and grammatical mistakes.
`,
});

const evaluateWritingFlow = ai.defineFlow(
  {
    name: 'evaluateWritingFlow',
    inputSchema: EvaluateWritingInputSchema,
    outputSchema: EvaluateWritingOutputSchema,
  },
  async (input) => {
    const { output } = await evaluateWritingPrompt(input);
    if (!output) {
      throw new Error('Failed to evaluate the writing.');
    }
    return output;
  }
);
