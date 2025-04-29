// Use server directive is crucial for Genkit flows.
'use server';

/**
 * @fileOverview AI agent to schedule an email from a prompt.
 * It extracts details and uses the sendEmailTool to actually send it (or schedule it via the tool if implemented).
 *
 * - scheduleEmailFromPrompt - A function that handles the scheduling of an email based on a prompt.
 * - ScheduleEmailFromPromptInput - The input type for the scheduleEmailFromPrompt function.
 * - ScheduleEmailFromPromptOutput - The return type for the scheduleEmailFromPrompt function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // Import the send email tool

const ScheduleEmailFromPromptInputSchema = z.object({
  prompt: z.string().describe(
    'A prompt describing the email\'s content, recipient, and desired sending time/details.'
  ),
});
export type ScheduleEmailFromPromptInput = z.infer<
  typeof ScheduleEmailFromPromptInputSchema
>;

// Updated output schema to reflect actual sending result
const ScheduleEmailFromPromptOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was successfully sent/scheduled.'),
  details: z.string().describe('Details about the action taken (e.g., email sent to X, or scheduling confirmation).'),
  messageId: z.string().optional().describe('The ID of the sent message, if available.'),
});
export type ScheduleEmailFromPromptOutput = z.infer<
  typeof ScheduleEmailFromPromptOutputSchema
>;

export async function scheduleEmailFromPrompt(
  input: ScheduleEmailFromPromptInput
): Promise<ScheduleEmailFromPromptOutput> {
  return scheduleEmailFromPromptFlow(input);
}

// Define the prompt that instructs the AI to use the tool
const emailSchedulingPrompt = ai.definePrompt({
  name: 'emailSchedulingPrompt',
  // Make the sendEmailTool available to the prompt
  tools: [sendEmailTool],
  input: {
    schema: ScheduleEmailFromPromptInputSchema,
  },
  output: {
    // The prompt's direct output describes the *intended* action,
    // the flow will handle the actual execution via the tool.
    schema: z.object({
      to: z.string().email().describe('The extracted recipient email address.'),
      subject: z.string().describe('The extracted or generated email subject.'),
      body: z.string().describe('The extracted or generated email body.'),
      // Note: Scheduling logic (parsing time from prompt) would ideally happen
      // either within the tool itself or in the flow *before* calling the tool,
      // depending on whether the email API supports scheduled sending.
      // For simplicity here, we assume immediate sending.
    }),
  },
  prompt: `You are an AI assistant specializing in handling email requests.
  Based on the user's prompt below, extract the recipient's email address, the subject, and compose the email body.
  Use the sendEmailTool to send the composed email immediately.
  If the prompt mentions a specific time, acknowledge it in your response details but send the email now using the tool.

  Prompt: {{{prompt}}}

  Ensure you extract all necessary details for the sendEmailTool.
  The JSON output of this prompt should represent the email to be sent.`,
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
  async (input) => {
    // 1. Run the prompt to extract email details and get the LLM's plan
    const llmResponse = await emailSchedulingPrompt(input);
    const emailDetails = llmResponse.output;

    if (!emailDetails) {
      throw new Error('LLM failed to extract email details from the prompt.');
    }

    // 2. Check if the LLM decided to use the sendEmailTool
    const toolRequest = llmResponse.toolRequests(sendEmailTool.name)[0];

    if (!toolRequest) {
      // This shouldn't happen based on the prompt, but handle it just in case.
      console.warn('LLM did not request to use the sendEmailTool.');
      return {
         success: false,
         details: 'Could not determine email details or failed to initiate sending.',
      }
    }

    // 3. Execute the sendEmailTool with the details extracted by the LLM
    console.log('Executing sendEmailTool with:', toolRequest.input);
    const toolOutput = await sendEmailTool(toolRequest.input);

    // 4. Construct the final output based on the tool's result
    return {
      success: toolOutput.success,
      details: toolOutput.success
        ? `Email successfully sent to ${toolRequest.input.to}. Subject: "${toolRequest.input.subject}"`
        : 'Failed to send the email via the tool.',
      messageId: toolOutput.messageId,
    };
  }
);
