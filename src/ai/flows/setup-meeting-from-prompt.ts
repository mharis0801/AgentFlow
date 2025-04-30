'use server';
/**
 * @fileOverview A meeting setup agent using structured input.
 * Sends calendar invites (via email simulation) based on form data.
 * Saves the meeting details and result to Firestore.
 *
 * - setupMeeting - A function that handles the meeting setup process from structured input.
 * - SetupMeetingInput - The input type for the setupMeeting function.
 * - SetupMeetingOutput - The return type for the setupMeeting function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // To send invites
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Define the structured input schema based on the form fields
const SetupMeetingInputSchema = z.object({
  title: z.string().min(1, { message: 'Meeting title is required.' }).describe('The title of the meeting.'),
  // Use comma or space separated emails and validate each
  attendees: z.string()
    .min(1, { message: 'At least one attendee email is required.' })
    .transform(val => val.split(/[\s,]+/)) // Split by space or comma
    .pipe(z.array(z.string().email({ message: "Invalid email address provided." })).min(1)),
  startTime: z.string().datetime({ message: "Invalid start date/time format." }).describe('The start time of the meeting in ISO format (UTC).'),
  endTime: z.string().datetime({ message: "Invalid end date/time format." }).describe('The end time of the meeting in ISO format (UTC).'),
  location: z.string().optional().describe('The location/link for the meeting (e.g., Google Meet link, physical address).'),
  agenda: z.string().optional().describe('A brief agenda or description for the meeting.'),
  currentUserEmail: z.string().email().describe('The email of the user making the request (organizer).'), // Kept for organizer context
  userId: z.string().describe("The UID of the user making the request."),
}).refine(data => new Date(data.startTime) < new Date(data.endTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
});

export type SetupMeetingInput = z.infer<typeof SetupMeetingInputSchema>;

// Output schema remains largely the same, might adjust MeetingDetails if needed
const MeetingDetailsOutputSchema = z.object({
    title: z.string().describe('The title of the meeting.'),
    attendees: z.array(z.string().email()).describe('The email addresses of the attendees.'),
    startTime: z.string().datetime().describe('The start time of the meeting in ISO format (UTC).'),
    endTime: z.string().datetime().describe('The end time of the meeting in ISO format (UTC).'),
    location: z.string().optional().describe('The location/link for the meeting.'),
    agenda: z.string().optional().describe('A brief agenda or description.'),
});
type MeetingDetails = z.infer<typeof MeetingDetailsOutputSchema>;


const SetupMeetingOutputSchema = z.object({
  meetingDetails: MeetingDetailsOutputSchema.describe('Details of the scheduled meeting.'),
  confirmationMessage: z.string().describe('A confirmation message summarizing the action taken.'),
  inviteSent: z.boolean().describe('Indicates if the simulated invitation email was sent.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type SetupMeetingOutput = z.infer<typeof SetupMeetingOutputSchema>;

// Renamed function to reflect structured input
export async function setupMeeting(input: SetupMeetingInput): Promise<SetupMeetingOutput> {
  // Validate input to ensure userId and email are provided
   if (!input.userId) {
      throw new Error("User ID must be provided to set up a meeting.");
   }
  if (!input.currentUserEmail) {
      throw new Error("Current user's email must be provided to set up a meeting.");
  }

   // Validate the rest of the input using Zod schema
   const validationResult = SetupMeetingInputSchema.safeParse(input);
   if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
      throw new Error(`Invalid input: ${errorMessage}`);
   }

  return setupMeetingFlow(validationResult.data); // Pass validated data
}


// Helper function to convert ISO string dates to Firestore Timestamps
// Note: Firestore Timestamps are needed for querying/ordering by date effectively
const convertDetailsToTimestamps = (details: MeetingDetails): Omit<MeetingDetails, 'startTime' | 'endTime'> & { startTime: Timestamp; endTime: Timestamp } => {
    return {
        ...details,
        startTime: Timestamp.fromDate(new Date(details.startTime)),
        endTime: Timestamp.fromDate(new Date(details.endTime)),
    };
};

// Define the flow using the structured input
const setupMeetingFlow = ai.defineFlow<
  typeof SetupMeetingInputSchema,
  typeof SetupMeetingOutputSchema
>(
  {
    name: 'setupMeetingFlow', // Renamed flow
    inputSchema: SetupMeetingInputSchema,
    outputSchema: SetupMeetingOutputSchema,
  },
  async (input) => {
    const { userId, currentUserEmail, ...meetingDetailsInput } = input;
    let taskId: string | undefined = undefined;
    let meetingDetails: MeetingDetails = { // Construct details object from input
        title: meetingDetailsInput.title,
        attendees: meetingDetailsInput.attendees,
        startTime: meetingDetailsInput.startTime,
        endTime: meetingDetailsInput.endTime,
        location: meetingDetailsInput.location,
        agenda: meetingDetailsInput.agenda,
    };
    let finalResult: SetupMeetingOutput;

    try {
      // Input is already validated by the calling function

      // Ensure the organizer is included if not already present
      if (!meetingDetails.attendees.includes(currentUserEmail)) {
         meetingDetails.attendees.push(currentUserEmail);
      }

      // Prepare details for Firestore (with Timestamps)
      const meetingDetailsForFirestore = convertDetailsToTimestamps(meetingDetails);

      // 1. Simulate sending calendar invites via email tool
      let inviteSent = false;
      let confirmationMessage = `Meeting details processed for "${meetingDetails.title}".`;
      let taskStatus: 'pending' | 'confirmed' | 'failed' | 'scheduled' = 'scheduled'; // Assume scheduled initially
      let taskResult: Record<string, any> | null = null;
      let taskError: string | null = null;

      // Construct the email payload for the sendEmailTool
      const inviteSubject = `Meeting Invitation: ${meetingDetails.title}`;
      const inviteBody = `
           <p>You are invited to the following meeting:</p>
           <p><b>Title:</b> ${meetingDetails.title}</p>
           <p><b>When:</b> ${new Date(meetingDetails.startTime).toLocaleString()} - ${new Date(meetingDetails.endTime).toLocaleString()}</p>
           <p><b>Attendees:</b> ${meetingDetails.attendees.join(', ')}</p>
           ${meetingDetails.location ? `<p><b>Location:</b> ${meetingDetails.location}</p>` : ''}
           ${meetingDetails.agenda ? `<p><b>Agenda:</b> ${meetingDetails.agenda}</p>` : ''}
           <p>---<br>Scheduled by AgentFlow</p>
         `;

      const toolInputPayload = {
          to: meetingDetails.attendees.join(','), // Send to all attendees
          subject: inviteSubject,
          body: inviteBody,
      };

      try {
          // Validate and execute the sendEmailTool
          sendEmailTool.inputSchema.parse(toolInputPayload); // Validate input for the tool
          console.log('Executing sendEmailTool with:', toolInputPayload);
          const toolOutput = await sendEmailTool(toolInputPayload);

          if (toolOutput.success) {
              inviteSent = true;
              confirmationMessage = `Meeting "${meetingDetails.title}" scheduled and invitation sent to ${meetingDetails.attendees.length} attendees.`;
              taskStatus = 'confirmed'; // Update status to confirmed as invite sent
              taskResult = { inviteSent: true, messageId: toolOutput.messageId };
              console.log('Simulated meeting invitation sent successfully.');
          } else {
              throw new Error(toolOutput.details || 'Failed to send invitation email via tool.');
          }
      } catch (toolError: any) {
          console.error('Failed to send meeting invitation:', toolError);
          confirmationMessage = `Meeting "${meetingDetails.title}" scheduled, but failed to send invitation email.`;
          taskStatus = 'failed'; // Mark as failed if email send fails
          taskError = toolError.message || 'Failed to send invitation email.';
          // Don't rethrow here, save the task as failed instead
      }


       // 2. Save the task details to Firestore
       try {
           taskId = await saveAgentTask({
               userId: userId,
               type: 'meeting',
               details: meetingDetailsForFirestore, // Save details with Timestamps
               status: taskStatus,
               result: taskResult,
               error: taskError,
           });
           console.log(`Meeting task saved with ID: ${taskId} and status: ${taskStatus}`);
       } catch (saveError: any) {
           // Log the detailed original save error before re-throwing
           console.error("Failed to save meeting task to Firestore (Original Error):", saveError);
           // Throw a new error indicating both scheduling and saving failed
           throw new Error(`Meeting processed (status: ${taskStatus}), but failed to save task: ${saveError.message}`);
       }


      finalResult = {
          meetingDetails: meetingDetails, // Return original details (with ISO strings) for consistency
          confirmationMessage: confirmationMessage,
          inviteSent: inviteSent,
          taskId: taskId,
      };
      return finalResult;

    } catch(error: any) {
         // This catches errors *before* or *during* the Firestore save attempt in the try block above
         console.error("Error in setupMeetingFlow:", error);
         let errorMessage = 'An unexpected error occurred during meeting setup.';
          if (error instanceof z.ZodError) { // Should be caught earlier, but good fallback
               errorMessage = `Invalid data format: ${error.errors.map(e => e.message).join(', ')}`;
          } else if (error.message) {
               errorMessage = error.message;
          }

         // Attempt to save failed task *only if* no task ID was assigned yet
         if (!taskId) {
             try {
                 // Convert details just before saving the error record
                 const detailsForErrorSave = meetingDetails ? convertDetailsToTimestamps(meetingDetails) : {};
                 taskId = await saveAgentTask({
                     userId: userId,
                     type: 'meeting',
                     details: detailsForErrorSave,
                     status: 'failed',
                     error: errorMessage,
                 });
                 console.log(`Saved failed meeting task with ID: ${taskId}`);
                 // Modify the error message slightly to indicate the task was at least recorded as failed
                 errorMessage += ` (Task recorded as failed with ID: ${taskId})`;
             } catch (saveError: any) {
                 console.error("CRITICAL: Failed to save even the error task to Firestore:", saveError);
                  // Append the critical save error message
                 errorMessage += ` CRITICAL: Failed to save error task to Firestore: ${saveError.message}`;
             }
         } else if (taskStatus !== 'failed') {
            // If taskId exists but the status wasn't 'failed' (e.g., save failed), update it
            try {
                await updateAgentTask(taskId, { status: 'failed', error: errorMessage });
                console.log(`Updated existing task ${taskId} to failed.`);
            } catch (updateError) {
                console.error(`Failed to update task ${taskId} to failed status after initial error:`, updateError);
                 errorMessage += ` Failed to update task status to failed: ${updateError}`;
            }
         }

        // Throw the (potentially augmented) error message to be caught by the frontend caller
        throw new Error(errorMessage);
    }
  }
);