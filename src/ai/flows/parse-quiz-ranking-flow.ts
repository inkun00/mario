'use server';
/**
 * @fileOverview A Genkit flow for parsing quiz ranking images.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Input Schema
const ParseRankingInputSchema = z.object({
  imageDataUri: z.string().describe("An image of a quiz result screen, as a data URI."),
});
export type ParseRankingInput = z.infer<typeof ParseRankingInputSchema>;

// Output Schema
const RankingEntrySchema = z.object({
  rank: z.number().describe("The rank of the student."),
  name: z.string().describe("The name of the student."),
});

const ParseRankingOutputSchema = z.object({
  rankings: z.array(RankingEntrySchema).describe("An array of student rankings extracted from the image."),
});
export type ParseRankingOutput = z.infer<typeof ParseRankingOutputSchema>;

// Exported wrapper function
export async function parseQuizRanking(input: ParseRankingInput): Promise<ParseRankingOutput> {
  return parseQuizRankingFlow(input);
}

// Prompt Definition
const parseRankingPrompt = ai.definePrompt({
  name: 'parseQuizRankingPrompt',
  input: { schema: ParseRankingInputSchema },
  output: { schema: ParseRankingOutputSchema },
  model: 'googleai/gemini-2.5-flash',
  prompt: `You are an OCR and data extraction expert.
Your task is to analyze the provided image of a quiz ranking screen and extract the rank and name of each student.
The names are in Korean. The output must be a sorted list based on the rank.

Analyze this image: {{media url=imageDataUri}}

Please extract the data and provide it in the specified JSON format.
Example:
If the image shows:
1. 김철수
2. 박영희
3. 이민준

The output should be:
{
  "rankings": [
    { "rank": 1, "name": "김철수" },
    { "rank": 2, "name": "박영희" },
    { "rank": 3, "name": "이민준" }
  ]
}
`,
});

// Flow Definition
const parseQuizRankingFlow = ai.defineFlow(
  {
    name: 'parseQuizRankingFlow',
    inputSchema: ParseRankingInputSchema,
    outputSchema: ParseRankingOutputSchema,
  },
  async (input) => {
    const { output } = await parseRankingPrompt(input);
    if (!output) {
      throw new Error('Failed to parse the ranking image.');
    }
    return output;
  }
);
