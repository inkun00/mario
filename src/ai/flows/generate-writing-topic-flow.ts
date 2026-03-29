'use server';
/**
 * @fileOverview A Genkit flow for generating a writing topic based on a student's learning weaknesses.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define input schema
const GenerateWritingTopicInputSchema = z.object({
  subjectStats: z.array(z.object({
    id: z.string(),
    totalCorrect: z.number(),
    totalIncorrect: z.number(),
    units: z.record(z.object({
      totalCorrect: z.number(),
      totalIncorrect: z.number(),
    })),
  })).describe("The student's performance statistics by subject and unit."),
});
export type GenerateWritingTopicInput = z.infer<typeof GenerateWritingTopicInputSchema>;

// Define output schema
const GenerateWritingTopicOutputSchema = z.object({
  topic: z.string().describe("The subject and unit identified as the weak area."),
  prompt: z.string().describe("A descriptive writing prompt based on the weak topic."),
});
export type GenerateWritingTopicOutput = z.infer<typeof GenerateWritingTopicOutputSchema>;


export async function generateWritingTopic(input: GenerateWritingTopicInput): Promise<GenerateWritingTopicOutput> {
  return generateWritingTopicFlow(input);
}

// Define a schema for the prompt's input, which will take a stringified version of the stats.
const PromptInputSchema = z.object({
  subjectStatsString: z.string(),
});

const generateWritingTopicPrompt = ai.definePrompt({
  name: 'generateWritingTopicPrompt',
  input: { schema: PromptInputSchema },
  output: { schema: GenerateWritingTopicOutputSchema },
  model: 'googleai/gemini-3.1-flash-lite-preview',
  prompt: `You are an expert elementary school teacher in South Korea.
Your task is to analyze the provided student learning data to identify their weakest subject and unit, and then create a descriptive writing prompt about a key concept from that topic.

**Student's Learning Data:**
\`\`\`json
{{{subjectStatsString}}}
\`\`\`

**Instructions:**
1.  **Analyze Data**: Review the 'subjectStats' to find the unit with the lowest accuracy (correct / (correct + incorrect)). If there are no incorrect answers, pick a random topic. If multiple units have low accuracy, pick one.
2.  **Identify Topic**: State the weakest area as the 'topic' (e.g., "과학 / 3. 여러 가지 기체").
3.  **Create Prompt**: Based on the identified topic, create an engaging descriptive writing prompt ('prompt') that encourages the student to explain a core concept from that unit in their own words. The prompt must be in Korean. For example, if the topic is about gases, you could ask: "공기 중에 있는 여러 가지 기체들은 우리 생활에서 어떻게 사용되는지, 각각의 특징과 함께 설명해주세요."
4.  **Output Format**: Ensure your response is in the specified JSON format.
`,
});

const generateWritingTopicFlow = ai.defineFlow(
  {
    name: 'generateWritingTopicFlow',
    inputSchema: GenerateWritingTopicInputSchema,
    outputSchema: GenerateWritingTopicOutputSchema,
  },
  async (input) => {
    // Stringify the subject stats before passing them to the prompt.
    const { output } = await generateWritingTopicPrompt({
      subjectStatsString: JSON.stringify(input.subjectStats, null, 2)
    });
    if (!output) {
      throw new Error('Failed to generate a writing topic.');
    }
    return output;
  }
);
