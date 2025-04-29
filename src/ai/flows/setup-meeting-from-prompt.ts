'use server';
/**
 * @fileOverview A meeting setup AI agent.
 *
 * - setupMeetingFromPrompt - A function that handles the meeting setup process.
 * - SetupMeetingFromPromptInput - The input type for the setupMeetingFromPrompt function.
 * - SetupMeetingFromPromptOutput - The return type for the setupMeetingFromPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const SetupMeetingFromPromptInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the meeting request.'),
});
export type SetupMeetingFromPromptInput = z.infer<typeof SetupMeetingFromPromptInputSchema>;

const SetupMeetingFromPromptOutputSchema = z.object({
  meetingDetails: z.object({
    title: z.string().describe('The title of the meeting.'),
    attendees: z.array(z.string().email()).describe('The email addresses of the attendees.'),
    startTime: z.string().datetime().describe('The start time of the meeting in ISO format.'),
    endTime: z.string().datetime().describe('The end time of the meeting in ISO format.'),
    location: z.string().optional().describe('The location of the meeting, if any.'),
    agenda: z.string().optional().describe('A brief agenda for the meeting, if any.'),
  }).describe('Details about the scheduled meeting'),
  confirmationMessage: z.string().describe('A confirmation message to display to the user.'),
});
export type SetupMeetingFromPromptOutput = z.infer<typeof SetupMeetingFromPromptOutputSchema>;

export async function setupMeetingFromPrompt(input: SetupMeetingFromPromptInput): Promise<SetupMeetingFromPromptOutput> {
  return setupMeetingFromPromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'setupMeetingFromPromptPrompt',
  input: {
    schema: z.object({
      prompt: z.string().describe('A prompt describing the meeting request.'),
    }),
  },
  output: {
    schema: z.object({
      meetingDetails: z.object({
        title: z.string().describe('The title of the meeting.'),
        attendees: z.array(z.string().email()).describe('The email addresses of the attendees.'),
        startTime: z.string().datetime().describe('The start time of the meeting in ISO format.'),
        endTime: z.string().datetime().describe('The end time of the meeting in ISO format.'),
        location: z.string().optional().describe('The location of the meeting, if any.'),
        agenda: z.string().optional().describe('A brief agenda for the meeting, if any.'),
      }).describe('Details about the scheduled meeting'),
      confirmationMessage: z.string().describe('A confirmation message to display to the user.'),
    }),
  },
  prompt: `You are an AI assistant tasked with scheduling meetings based on user prompts. Please extract the necessary information from the prompt to schedule the meeting and provide a confirmation message to the user. The output should be in JSON format.

Prompt: {{{prompt}}}

Consider these requirements:
* Ensure that all email addresses are valid.
* The start time must be before the end time.
* All times are Eastern Standard Time.

Output:`, 
});

const setupMeetingFromPromptFlow = ai.defineFlow<
  typeof SetupMeetingFromPromptInputSchema,
  typeof SetupMeetingFromPromptOutputSchema
>(
  {
    name: 'setupMeetingFromPromptFlow',
    inputSchema: SetupMeetingFromPromptInputSchema,
    outputSchema: SetupMeetingFromPromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
