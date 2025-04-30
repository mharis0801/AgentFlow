
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
import { saveAgentTask, AgentTaskPayload } from '@/services/firestore'; // Import Firestore service

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

    let taskStatus: AgentTaskPayload['status'] = 'pending'; // Start as pending
    let taskResult: Record<string, any> | null = null;
    let taskError: string | null = null;

    try {
      // Input is already validated by the calling function

      // 1. Execute the sendEmailTool with the provided details
      console.log('Executing sendEmailTool with:', emailDetails);
      // Validate the input against the tool's schema (double-check)
      const validatedInput = sendEmailTool.inputSchema.parse(emailDetails);
      const toolOutput = await sendEmailTool(validatedInput);

      // 2. Construct the final output based on the tool's result
      if (toolOutput.success) {
         taskStatus = 'sent'; // Use 'sent' as success status
         taskResult = { messageId: toolOutput.messageId };
         taskError = null;
         finalResult = {
             success: true,
             details: `Email successfully sent to ${validatedInput.to}. Subject: "${validatedInput.subject}"`,
             messageId: toolOutput.messageId,
         };
         console.log('Email tool execution successful.');
      } else {
          // If the tool itself reports failure (e.g., simulated error)
          taskStatus = 'failed';
          taskError = toolOutput.details || 'Failed to send email via the tool.';
          taskResult = null;
           finalResult = {
               success: false,
               details: taskError,
               messageId: undefined,
           };
           console.error('Email tool execution failed:', taskError);
           // Do not throw here, let the task be saved as failed
      }

      // 3. Save the task details to Firestore regardless of tool success/failure
       try {
           const taskToSave: Omit<AgentTaskPayload, 'createdAt' | 'updatedAt'> = {
               userId: userId,
               type: 'email',
               details: taskDetailsToSave, // Save the prepared details
               status: taskStatus,
               result: taskResult,
               error: taskError,
           };
           taskId = await saveAgentTask(taskToSave);
           finalResult.taskId = taskId; // Add taskId to the result
           console.log(`Email task saved with ID: ${taskId} and status: ${taskStatus}`);
       } catch (saveError: any) {
           // Log the detailed original save error
           console.error("Failed to save email task to Firestore (Original Error):", saveError);
           // Modify the final result message to indicate saving failed, but don't throw
           finalResult.details += ` (Warning: Failed to save task status to database: ${saveError.message})`;
           finalResult.taskId = undefined; // Ensure taskId is not set if saving failed
           // Do not rethrow here to allow the flow to return the (partial) result
       }

       return finalResult; // Return the result, possibly with a warning about saving

    } catch (error: any) {
      // This catch block handles errors *during* the flow execution itself
      // (e.g., tool input validation errors, unexpected tool execution errors)
      console.error('Critical error in scheduleEmailFlow before task saving:', error);
      let errorMessage = 'An unexpected error occurred during email processing.';
      if (error instanceof z.ZodError) { // Error during tool input validation
        errorMessage = `Invalid data format for email tool: ${error.errors.map(e => e.message).join(', ')}`;
      } else if (error.message) {
        errorMessage = error.message; // Capture tool execution error etc.
      }

       // Attempt to save a failed task record *if* the error happened before the main save block
       try {
           const failedTaskPayload: Omit<AgentTaskPayload, 'createdAt' | 'updatedAt'> = {
               userId: userId,
               type: 'email',
               details: taskDetailsToSave, // Save the intended details
               status: 'failed',
               error: errorMessage,
               result: null,
           };
           taskId = await saveAgentTask(failedTaskPayload);
           console.log(`Saved failed email task record with ID: ${taskId}`);
           // Modify the error message slightly to indicate the task was at least recorded as failed
           errorMessage += ` (Task recorded as failed with ID: ${taskId})`;
       } catch (saveError: any) {
            // Log the critical save error
            console.error("CRITICAL: Failed to save even the error task to Firestore:", saveError);
            errorMessage += ` CRITICAL: Failed to save error status to Firestore: ${saveError.message}`;
       }

       // Throw the original or augmented error message to be caught by the frontend
       throw new Error(errorMessage);
    }
  }
);

