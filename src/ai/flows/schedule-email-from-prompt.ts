// Use server directive is crucial for Genkit flows.
'use server';

/**
 * @fileOverview AI agent to schedule an email from a prompt.
 * It extracts details and uses the sendEmailTool to actually send it (or schedule it via the tool if implemented).
 * Saves the task details and result to Firestore.
 *
 * - scheduleEmailFromPrompt - A function that handles the scheduling of an email based on a prompt.
 * - ScheduleEmailFromPromptInput - The input type for the scheduleEmailFromPrompt function.
 * - ScheduleEmailFromPromptOutput - The return type for the scheduleEmailFromPrompt function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // Import the send email tool
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service
import { auth } from '@/lib/firebase/firebase'; // Import Firebase auth instance

const ScheduleEmailFromPromptInputSchema = z.object({
  prompt: z.string().describe(
    'A prompt describing the email\'s content, recipient, and desired sending time/details.'
  ),
   // Add userId to input schema
   userId: z.string().describe("The UID of the user making the request."),
});
export type ScheduleEmailFromPromptInput = z.infer<
  typeof ScheduleEmailFromPromptInputSchema
>;

// Updated output schema to reflect actual sending result
const ScheduleEmailFromPromptOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was successfully sent/scheduled.'),
  details: z.string().describe('Details about the action taken (e.g., email sent to X, or scheduling confirmation).'),
  messageId: z.string().optional().describe('The ID of the sent message, if available.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type ScheduleEmailFromPromptOutput = z.infer<
  typeof ScheduleEmailFromPromptOutputSchema
>;

export async function scheduleEmailFromPrompt(
  input: ScheduleEmailFromPromptInput
): Promise<ScheduleEmailFromPromptOutput> {
   // Ensure userId is provided
   if (!input.userId) {
      throw new Error("User ID must be provided to schedule an email.");
   }
  return scheduleEmailFromPromptFlow(input);
}

// Define the prompt that instructs the AI to use the tool
const emailSchedulingPrompt = ai.definePrompt({
  name: 'emailSchedulingPrompt',
  // Make the sendEmailTool available to the prompt
  tools: [sendEmailTool],
  input: {
    // Schema now includes userId, but prompt doesn't need it directly
     schema: ScheduleEmailFromPromptInputSchema.omit({ userId: true }), // Omit userId for the prompt itself
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
  The JSON output of this prompt should represent the email to be sent. If you cannot extract the required details (to, subject, body), explain why in the 'body' field and do not attempt to use the tool.`,
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
    const { userId, prompt } = input;
    let taskId: string | undefined = undefined;
    let finalResult: ScheduleEmailFromPromptOutput;

    try {
      // 1. Run the prompt to extract email details and get the LLM's plan
      // Pass only the prompt to the LLM as userId is not needed for extraction
      const llmResponse = await emailSchedulingPrompt({ prompt });
      const emailDetails = llmResponse.output;

      if (!emailDetails) {
        throw new Error('AI failed to process the request. No email details were generated.');
      }

      // 2. Check if the LLM decided to use the sendEmailTool
      const toolRequest = llmResponse.toolRequests(sendEmailTool.name)[0];

      if (!toolRequest) {
        const failureReason = emailDetails.body || 'Could not determine email details or failed to initiate sending.';
         finalResult = {
             success: false,
             details: `Failed: ${failureReason}`,
         };
         // Save failed task
         taskId = await saveAgentTask({
             userId: userId,
             type: 'email',
             prompt: prompt,
             details: emailDetails, // Save the intended details
             status: 'failed',
             error: failureReason,
         });
         finalResult.taskId = taskId;
         return finalResult;
      }

      // 3. Execute the sendEmailTool with the details extracted by the LLM
      console.log('Executing sendEmailTool with:', toolRequest.input);
      const validatedInput = sendEmailTool.inputSchema.parse(toolRequest.input);
      const toolOutput = await sendEmailTool(validatedInput);

      // 4. Construct the final output based on the tool's result
      if (toolOutput.success) {
         finalResult = {
             success: true,
             details: `Email successfully sent to ${validatedInput.to}. Subject: "${validatedInput.subject}"`,
             messageId: toolOutput.messageId,
         };
         // Save successful task
         taskId = await saveAgentTask({
             userId: userId,
             type: 'email',
             prompt: prompt,
             details: validatedInput, // Save the sent details
             status: 'completed', // Or 'sent' if you prefer
             result: { messageId: toolOutput.messageId },
         });
         finalResult.taskId = taskId;
      } else {
         finalResult = {
            success: false,
            details: 'Failed to send the email via the tool.',
         };
          // Save failed task (tool execution failed)
         taskId = await saveAgentTask({
             userId: userId,
             type: 'email',
             prompt: prompt,
             details: validatedInput,
             status: 'failed',
             error: 'Failed to send the email via the tool.',
         });
          finalResult.taskId = taskId;
      }
       return finalResult;

    } catch (error: any) {
      console.error('Error in scheduleEmailFromPromptFlow:', error);
      let errorMessage = 'An unexpected error occurred during email scheduling.';
      if (error instanceof z.ZodError) {
        errorMessage = `Invalid data format: ${error.errors.map(e => e.message).join(', ')}`;
      } else if (error.message) {
        errorMessage = error.message;
      }

       finalResult = {
           success: false,
           details: errorMessage,
       };

       // Attempt to save failed task, even if some details might be missing
       try {
           taskId = await saveAgentTask({
               userId: userId,
               type: 'email',
               prompt: prompt,
               details: {}, // Use empty details if extraction failed early
               status: 'failed',
               error: errorMessage,
           });
           finalResult.taskId = taskId;
       } catch (saveError) {
           console.error("Failed to save error task to Firestore:", saveError);
           // Don't overwrite the original error message
       }

      // Re-throw the original error or return the structured failure response
      // It's often better to return the structured response so the UI can handle it
       return finalResult;
       // OR: throw new Error(errorMessage); // If you prefer to throw
    }
  }
);
