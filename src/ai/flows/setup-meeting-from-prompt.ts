'use server';
/**
 * @fileOverview A meeting setup AI agent.
 * Uses tools to potentially read email requests and send calendar invites (via email).
 *
 * - setupMeetingFromPrompt - A function that handles the meeting setup process.
 * - SetupMeetingFromPromptInput - The input type for the setupMeetingFromPrompt function.
 * - SetupMeetingFromPromptOutput - The return type for the setupMeetingFromPrompt function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import { sendEmailTool } from '@/ai/tools/send-email'; // To send invites
// Removed unused import: import { auth } from '@/lib/firebase/firebase';
// import { readEmailsTool } from '@/ai/tools/email-reader'; // Potential future use

// Input now includes the user's email
const SetupMeetingFromPromptInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the meeting request (e.g., participants, time, topic).'),
  currentUserEmail: z.string().email().describe('The email of the user making the request (organizer).'),
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

// Output includes the meeting details and confirmation
const SetupMeetingFromPromptOutputSchema = z.object({
  meetingDetails: MeetingDetailsSchema.describe('Details of the scheduled meeting.'),
  confirmationMessage: z.string().describe('A confirmation message summarizing the action taken (e.g., invites sent).'),
  inviteSent: z.boolean().describe('Indicates if the simulated invitation email was sent.'),
});
export type SetupMeetingFromPromptOutput = z.infer<typeof SetupMeetingFromPromptOutputSchema>;

export async function setupMeetingFromPrompt(input: SetupMeetingFromPromptInput): Promise<SetupMeetingFromPromptOutput> {
  // Validate input to ensure currentUserEmail is provided
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
    // Schema matches the flow's input schema now
    schema: SetupMeetingFromPromptInputSchema,
  },
  output: {
    // Output schema focuses on the *parsed* meeting details.
    schema: MeetingDetailsSchema,
  },
  prompt: `You are an AI assistant tasked with scheduling meetings based on user prompts.
  Your goal is to extract the meeting details (title, attendees, start/end times, location, agenda) from the prompt.
  Ensure times are converted to UTC ISO format. The user making the request is {{currentUserEmail}}. Include them as an attendee unless explicitly told not to.

  Prompt: {{{prompt}}}

  After extracting the details, determine if a calendar invitation should be sent to the attendees using the sendEmailTool.
  The tool input should include all attendees in the 'to' field (comma-separated if the tool supports it, otherwise call per attendee - assume comma separated for now),
  a subject like "Meeting Invitation: [Meeting Title]", and a body summarizing the meeting details (attendees, time, location, agenda).

  Return ONLY the extracted meeting details as a JSON object conforming to the output schema. The flow will handle calling the tool based on your decision.`,
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
  async (input) => {
    // Current user's email is now passed directly in the input
    const currentUserEmail = input.currentUserEmail;

    // 1. Run the prompt to extract meeting details, passing the input which includes currentUserEmail
    const llmResponse = await meetingSetupPrompt(input);
    const meetingDetails = llmResponse.output;

    if (!meetingDetails) {
      throw new Error('LLM failed to extract meeting details from the prompt.');
    }

    // Ensure the organizer is included if not already present
    if (!meetingDetails.attendees.includes(currentUserEmail)) {
       meetingDetails.attendees.push(currentUserEmail);
    }

    // 2. Check if the LLM decided to use the sendEmailTool for invites
    const toolRequest = llmResponse.toolRequests(sendEmailTool.name)[0];
    let inviteSent = false;
    let confirmationMessage = `Meeting details extracted for "${meetingDetails.title}".`;

    if (toolRequest) {
      console.log('LLM requested sending an invite. Executing sendEmailTool with:', toolRequest.input);
      try {
         // Re-construct the tool input based on extracted details for robustness
         // (or trust the LLM's generated input if simple enough)
         const inviteSubject = `Meeting Invitation: ${meetingDetails.title}`;
         const inviteBody = `
           <p>You are invited to the following meeting:</p>
           <p><b>Title:</b> ${meetingDetails.title}</p>
           <p><b>When:</b> ${new Date(meetingDetails.startTime).toLocaleString()} - ${new Date(meetingDetails.endTime).toLocaleString()} (UTC)</p>
           <p><b>Attendees:</b> ${meetingDetails.attendees.join(', ')}</p>
           ${meetingDetails.location ? `<p><b>Location:</b> ${meetingDetails.location}</p>` : ''}
           ${meetingDetails.agenda ? `<p><b>Agenda:</b> ${meetingDetails.agenda}</p>` : ''}
           <p>---<br>Scheduled by AgentFlow</p>
         `;

         // Ensure the tool input is correctly formatted based on sendEmailTool's inputSchema
         const toolInputPayload = {
             to: meetingDetails.attendees.join(','), // Assuming the tool handles comma-separated list
             subject: inviteSubject,
             body: inviteBody,
         };

         // Validate toolInputPayload against sendEmailTool's inputSchema (optional but recommended)
         try {
            sendEmailTool.inputSchema.parse(toolInputPayload);
         } catch (validationError) {
            console.error("Tool input validation failed:", validationError);
            throw new Error("Failed to construct valid input for sendEmailTool.");
         }


         const toolOutput = await sendEmailTool(toolInputPayload);

         if (toolOutput.success) {
           inviteSent = true;
           confirmationMessage = `Meeting "${meetingDetails.title}" details extracted and invitation sent to ${meetingDetails.attendees.length} attendees.`;
           console.log('Simulated meeting invitation sent successfully.');
         } else {
           confirmationMessage = `Meeting "${meetingDetails.title}" details extracted, but failed to send invitation email.`;
           console.error('Failed to send simulated meeting invitation.');
         }
      } catch(toolError) {
         console.error("Error executing sendEmailTool for meeting invite:", toolError);
         confirmationMessage = `Meeting "${meetingDetails.title}" details extracted, but encountered an error sending the invitation.`;
      }

    } else {
      console.log('LLM did not request sending an invite for this meeting setup.');
      // You might still want to save the meeting to a user's calendar here
      // using a different tool or service call.
      confirmationMessage = `Meeting "${meetingDetails.title}" details extracted. No invite requested by AI.`;
    }

    // 3. Return the final result including meeting details and confirmation
    // TODO: Integrate with a real calendar API (Google Calendar, Outlook Calendar)
    // to create the actual event instead of just sending an email.

    return {
      meetingDetails: meetingDetails,
      confirmationMessage: confirmationMessage,
      inviteSent: inviteSent,
    };
  }
);
