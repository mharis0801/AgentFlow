'use server';
/**
 * @fileOverview AI agent to send an email based on structured form input.
 * Uses the sendEmailTool to actually send it.
 * Saves the task details and result to Firestore.
 *
 * - scheduleEmail - A function that handles sending an email based on form data.
 * - ScheduleEmailInput - The input type for the scheduleEmail function.
 * - ScheduleEmailOutput - The return type for the scheduleEmail function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // Import the send email tool
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service

// Define the structured input schema based on the form fields
const ScheduleEmailInputSchema = z.object({
  to: z.string().email().describe('The recipient email address.'),
  subject: z.string().describe('The email subject.'),
  body: z.string().describe('The email body content.'),
  userId: z.string().describe("The UID of the user making the request."),
  // Optional: Add scheduling field if implemented later
  // scheduledTime: z.string().datetime().optional().describe('Optional ISO timestamp for scheduling.'),
});
export type ScheduleEmailInput = z.infer<typeof ScheduleEmailInputSchema>;

// Output schema remains the same
const ScheduleEmailOutputSchema = z.object({
  success: z.boolean().describe('Whether the email was successfully sent.'),
  details: z.string().describe('Details about the action taken (e.g., email sent to X).'),
  messageId: z.string().optional().describe('The ID of the sent message, if available.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type ScheduleEmailOutput = z.infer<typeof ScheduleEmailOutputSchema>;

// Renamed function to reflect structured input
export async function scheduleEmail(
  input: ScheduleEmailInput
): Promise<ScheduleEmailOutput> {
   // Ensure userId is provided
   if (!input.userId) {
      throw new Error("User ID must be provided to send an email.");
   }
    // Validate the rest of the input
    const validationResult = ScheduleEmailInputSchema.safeParse(input);
    if (!validationResult.success) {
        const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        throw new Error(`Invalid input: ${errorMessage}`);
    }
    return scheduleEmailFlow(validationResult.data); // Pass validated data
}


// Define the flow using the structured input
const scheduleEmailFlow = ai.defineFlow<
  typeof ScheduleEmailInputSchema,
  typeof ScheduleEmailOutputSchema
>(
  {
    name: 'scheduleEmailFlow', // Renamed flow
    inputSchema: ScheduleEmailInputSchema,
    outputSchema: ScheduleEmailOutputSchema,
  },
  async (input) => {
    const { userId, ...emailDetails } = input; // Destructure userId and email details
    let taskId: string | undefined = undefined;
    let finalResult: ScheduleEmailOutput;

    // Prepare email details for saving (can be done before tool execution)
    const taskDetailsToSave = {
        to: emailDetails.to,
        subject: emailDetails.subject,
        // Optionally include a snippet of the body or omit it for privacy
        // bodySnippet: emailDetails.body.substring(0, 100) + '...',
    };

    try {
      // Input is already validated by the calling function

      // 1. Execute the sendEmailTool with the provided details
      console.log('Executing sendEmailTool with:', emailDetails);
      // Validate the input against the tool's schema (double-check)
      const validatedInput = sendEmailTool.inputSchema.parse(emailDetails);
      const toolOutput = await sendEmailTool(validatedInput);

      // 2. Construct the final output based on the tool's result
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
             details: taskDetailsToSave, // Save the prepared details
             status: 'sent', // Use 'sent' or 'completed'
             result: { messageId: toolOutput.messageId },
             error: null, // Ensure error is null on success
         });
         finalResult.taskId = taskId;
      } else {
          // If the tool itself reports failure (e.g., simulated error)
          const toolFailureMsg = toolOutput.details || 'Failed to send email via the tool.';
           taskId = await saveAgentTask({
               userId: userId,
               type: 'email',
               details: taskDetailsToSave,
               status: 'failed',
               error: toolFailureMsg,
               result: null, // Ensure result is null on failure
           });
           finalResult = {
               success: false,
               details: toolFailureMsg,
               messageId: undefined,
               taskId: taskId,
           };
           // Do not throw here if you want to return the failed state gracefully
           // throw new Error(toolFailureMsg);
      }
       return finalResult;

    } catch (error: any) {
      // This catch block handles errors *during* the flow execution
      // (e.g., validation errors, tool execution errors not caught above, Firestore errors)
      console.error('Error in scheduleEmailFlow:', error);
      let errorMessage = 'An unexpected error occurred during email sending.';
      if (error instanceof z.ZodError) { // Error during tool input validation
        errorMessage = `Invalid data format for email tool: ${error.errors.map(e => e.message).join(', ')}`;
      } else if (error.message) {
        errorMessage = error.message; // Capture tool execution error or Firestore error
      }

       // Attempt to save failed task, *only if* it wasn't already saved as failed above
       if (taskId === undefined) { // Check if taskId is still undefined
         try {
             taskId = await saveAgentTask({
                 userId: userId,
                 type: 'email',
                 details: taskDetailsToSave, // Save the intended details
                 status: 'failed',
                 error: errorMessage,
                 result: null,
             });
         } catch (saveError: any) {
            // Log the detailed original save error before re-throwing
             console.error("Failed to save error task to Firestore (Original Error):", saveError);
             errorMessage = `${errorMessage}. Additionally, failed to save error status: ${saveError.message}`;
         }
       }

       // Throw the error to be caught by the frontend
       throw new Error(errorMessage);
    }
  }
);