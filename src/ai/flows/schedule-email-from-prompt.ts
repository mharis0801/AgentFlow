// Use server directive is crucial for Genkit flows.
'use server';

/**
 * @fileOverview AI agent to schedule an email from a prompt.
 *
 * - scheduleEmailFromPrompt - A function that handles the scheduling of an email based on a prompt.
 * - ScheduleEmailFromPromptInput - The input type for the scheduleEmailFromPrompt function.
 * - ScheduleEmailFromPromptOutput - The return type for the scheduleEmailFromPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ScheduleEmailFromPromptInputSchema = z.object({
  prompt: z.string().describe(
    'A prompt describing the email\'s content, recipient, and desired sending time.'
  ),
});
export type ScheduleEmailFromPromptInput = z.infer<
  typeof ScheduleEmailFromPromptInputSchema
>;

const ScheduleEmailFromPromptOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was successfully scheduled.'),
  details: z.string().describe('Details about the scheduled email.'),
});
export type ScheduleEmailFromPromptOutput = z.infer<
  typeof ScheduleEmailFromPromptOutputSchema
>;

export async function scheduleEmailFromPrompt(
  input: ScheduleEmailFromPromptInput
): Promise<ScheduleEmailFromPromptOutput> {
  return scheduleEmailFromPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'scheduleEmailFromPromptPrompt',
  input: {
    schema: z.object({
      prompt: z
        .string()
        .describe(
          'A prompt describing the email\'s content, recipient, and desired sending time.'
        ),
    }),
  },
  output: {
    schema: z.object({
      success: z.boolean().describe('Whether the email was successfully scheduled.'),
      details: z.string().describe('Details about the scheduled email.'),
    }),
  },
  prompt: `You are an AI assistant specializing in scheduling emails.

  Based on the user's prompt, draft the email and schedule it for sending.

  Prompt: {{{prompt}}}

  Ensure that the output includes details about the scheduled email, such as recipient,
  subject, and sending time.
  The output should be valid JSON. Do not include any markdown formatting.
  `,
});

const scheduleEmailFromPromptFlow = ai.defineFlow<
  typeof ScheduleEmailFromPromptInputSchema,
  typeof ScheduleEmailFromPromptOutputSchema
>(
  {
    name: 'scheduleEmailFromPromptFlow',
    inputSchema: ScheduleEmailFromPromptInputSchema,
    outputSchema: ScheduleEmailFromPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
