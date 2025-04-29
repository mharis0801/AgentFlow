'use server';
/**
 * @fileOverview A meeting setup AI agent.
 * Uses tools to potentially read email requests and send calendar invites (via email).
 * Saves the meeting details and result to Firestore.
 *
 * - setupMeetingFromPrompt - A function that handles the meeting setup process.
 * - SetupMeetingFromPromptInput - The input type for the setupMeetingFromPrompt function.
 * - SetupMeetingFromPromptOutput - The return type for the setupMeetingFromPrompt function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // To send invites
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// Input includes the user's email (already present)
const SetupMeetingFromPromptInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the meeting request (e.g., participants, time, topic).'),
  currentUserEmail: z.string().email().describe('The email of the user making the request (organizer).'),
   userId: z.string().describe("The UID of the user making the request."), // Added userId
});
export type SetupMeetingFromPromptInput = z.infer<typeof SetupMeetingFromPromptInputSchema>;

const MeetingDetailsSchema = z.object({
    title: z.string().describe('The title of the meeting.'),
    attendees: z.array(z.string().email()).describe('The email addresses of the attendees.'),
    startTime: z.string().datetime().describe('The start time of the meeting in ISO format (UTC).'),
    endTime: z.string().datetime().describe('The end time of the meeting in ISO format (UTC).'),
    location: z.string().optional().describe('The location/link for the meeting (e.g., Google Meet link, physical address).'),
    agenda: z.string().optional().describe('A brief agenda or description for the meeting.'),
});
// Convert Zod schema to a type for internal use if needed, or use z.infer
type MeetingDetails = z.infer<typeof MeetingDetailsSchema>;

// Output includes the meeting details, confirmation, and task ID
const SetupMeetingFromPromptOutputSchema = z.object({
  meetingDetails: MeetingDetailsSchema.describe('Details of the scheduled meeting.'),
  confirmationMessage: z.string().describe('A confirmation message summarizing the action taken (e.g., invites sent).'),
  inviteSent: z.boolean().describe('Indicates if the simulated invitation email was sent.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type SetupMeetingFromPromptOutput = z.infer<typeof SetupMeetingFromPromptOutputSchema>;

export async function setupMeetingFromPrompt(input: SetupMeetingFromPromptInput): Promise<SetupMeetingFromPromptOutput> {
  // Validate input to ensure userId is provided
   if (!input.userId) {
      throw new Error("User ID must be provided to set up a meeting.");
   }
  if (!input.currentUserEmail) {
      throw new Error("Current user's email must be provided to set up a meeting.");
  }
  return setupMeetingFromPromptFlow(input);
}

// The prompt now focuses on extracting details and deciding *if* an invite needs sending.
const meetingSetupPrompt = ai.definePrompt({
  name: 'meetingSetupPrompt',
  // Provide the sendEmailTool for sending invites
  tools: [sendEmailTool],
  input: {
    // Schema matches the flow's input schema, excluding userId for the prompt
     schema: SetupMeetingFromPromptInputSchema.omit({ userId: true }),
  },
  output: {
    // Output schema focuses on the *parsed* meeting details.
    schema: MeetingDetailsSchema,
  },
  prompt: `You are an AI assistant tasked with scheduling meetings based on user prompts.
  Your goal is to extract the meeting details (title, attendees, start/end times in UTC ISO format, location, agenda) from the prompt.
  The user making the request is {{currentUserEmail}}. Include them as an attendee unless explicitly told not to.

  Prompt: {{{prompt}}}

  After extracting the details, decide if a calendar invitation should be sent to the attendees using the sendEmailTool.
  Construct the input for the sendEmailTool: use a comma-separated list of attendee emails for the 'to' field, a subject like "Meeting Invitation: [Meeting Title]", and a body summarizing the meeting details (attendees, time, location, agenda).

  Return ONLY the extracted meeting details as a JSON object conforming to the output schema. The flow will handle calling the tool based on your decision. If you cannot extract required details (title, attendees, startTime, endTime), explain the issue in the 'title' field and return default/empty values for others.`,
});


// Helper function to convert ISO string dates to Firestore Timestamps
const convertDetailsToTimestamps = (details: MeetingDetails): MeetingDetails => {
    return {
        ...details,
        startTime: Timestamp.fromDate(new Date(details.startTime)).toDate().toISOString(), // Keep as ISO string for now if needed by tool
        endTime: Timestamp.fromDate(new Date(details.endTime)).toDate().toISOString(),
        // If storing in Firestore directly, use Timestamp.fromDate(new Date(details.startTime))
    };
};

const setupMeetingFromPromptFlow = ai.defineFlow<
  typeof SetupMeetingFromPromptInputSchema,
  typeof SetupMeetingFromPromptOutputSchema
>(
  {
    name: 'setupMeetingFromPromptFlow',
    inputSchema: SetupMeetingFromPromptInputSchema,
    outputSchema: SetupMeetingFromPromptOutputSchema,
  },
  async (input) => {
    const { userId, currentUserEmail, prompt } = input;
    let taskId: string | undefined = undefined;
    let meetingDetails: MeetingDetails | null = null;
    let finalResult: SetupMeetingFromPromptOutput;

    try {
      // 1. Run the prompt to extract meeting details
       // Pass currentUserEmail and prompt to the LLM
      const llmResponse = await meetingSetupPrompt({ currentUserEmail, prompt });
      meetingDetails = llmResponse.output; // Keep original details for saving

      if (!meetingDetails || meetingDetails.title.toLowerCase().includes('issue') || meetingDetails.title.toLowerCase().includes('fail')) {
        throw new Error(meetingDetails?.title || 'LLM failed to extract meeting details from the prompt.');
      }

      // Ensure the organizer is included if not already present
      if (!meetingDetails.attendees.includes(currentUserEmail)) {
         meetingDetails.attendees.push(currentUserEmail);
      }

      // Convert date strings to Timestamps for Firestore storage *after* potential tool use
       const meetingDetailsForFirestore = convertDetailsToTimestamps(meetingDetails);


      // 2. Check if the LLM decided to use the sendEmailTool for invites
      const toolRequest = llmResponse.toolRequests(sendEmailTool.name)[0];
      let inviteSent = false;
      let confirmationMessage = `Meeting details extracted for "${meetingDetails.title}".`;
      let taskStatus: 'pending' | 'confirmed' | 'failed' = 'pending'; // Default status
      let taskResult: Record<string, any> | null = null;
      let taskError: string | null = null;

      if (toolRequest) {
        console.log('LLM requested sending an invite. Executing sendEmailTool with:', toolRequest.input);
         // Re-construct the tool input based on extracted details for robustness
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
             to: meetingDetails.attendees.join(','),
             subject: inviteSubject,
             body: inviteBody,
         };

         // Validate toolInputPayload
         sendEmailTool.inputSchema.parse(toolInputPayload);

         const toolOutput = await sendEmailTool(toolInputPayload);

         if (toolOutput.success) {
           inviteSent = true;
           confirmationMessage = `Meeting "${meetingDetails.title}" details extracted and invitation sent to ${meetingDetails.attendees.length} attendees.`;
           taskStatus = 'confirmed'; // Or 'scheduled'
           taskResult = { inviteSent: true, messageId: toolOutput.messageId };
           console.log('Simulated meeting invitation sent successfully.');
         } else {
           confirmationMessage = `Meeting "${meetingDetails.title}" details extracted, but failed to send invitation email.`;
           taskStatus = 'failed';
           taskError = 'Failed to send invitation email via tool.';
           console.error('Failed to send simulated meeting invitation.');
         }

      } else {
        console.log('LLM did not request sending an invite for this meeting setup.');
        confirmationMessage = `Meeting "${meetingDetails.title}" details extracted. No invite requested by AI.`;
         taskStatus = 'confirmed'; // Consider it confirmed/saved even without invite
         taskResult = { inviteSent: false };
      }

       // Convert details again before saving, ensuring Timestamps
       const finalDetailsForFirestore = {
            ...meetingDetails,
            // Ensure startTime and endTime are Timestamps for Firestore
            startTime: Timestamp.fromDate(new Date(meetingDetails.startTime)),
            endTime: Timestamp.fromDate(new Date(meetingDetails.endTime)),
       };


       // 3. Save the task details to Firestore
       taskId = await saveAgentTask({
           userId: userId,
           type: 'meeting',
           prompt: prompt,
           details: finalDetailsForFirestore,
           status: taskStatus,
           result: taskResult,
           error: taskError,
       });


      finalResult = {
          meetingDetails: meetingDetails, // Return original details (with ISO strings)
          confirmationMessage: confirmationMessage,
          inviteSent: inviteSent,
          taskId: taskId,
      };
      return finalResult;

    } catch(error: any) {
         console.error("Error in setupMeetingFromPromptFlow:", error);
         let errorMessage = 'An unexpected error occurred during meeting setup.';
          if (error instanceof z.ZodError) {
               errorMessage = `Invalid data format for tool: ${error.errors.map(e => e.message).join(', ')}`;
          } else if (error.message) {
               errorMessage = error.message;
          }

         finalResult = {
            // Provide default/empty meeting details on failure
            meetingDetails: {
                title: "Error",
                attendees: [],
                startTime: new Date(0).toISOString(), // Epoch time
                endTime: new Date(0).toISOString(),
            },
            confirmationMessage: errorMessage,
            inviteSent: false,
         };

       // Attempt to save failed task
       try {
           taskId = await saveAgentTask({
               userId: userId,
               type: 'meeting',
               prompt: prompt,
               details: meetingDetails || {}, // Save partial details if available
               status: 'failed',
               error: errorMessage,
           });
           finalResult.taskId = taskId;
       } catch (saveError) {
           console.error("Failed to save error task to Firestore:", saveError);
       }

        return finalResult;
    }
  }
);
