'use server';
/**
 * @fileOverview This file defines a Genkit flow for booking hotel reservations based on user prompts.
 * Saves the booking details and result to Firestore.
 *
 * - bookHotelReservationFromPrompt - A function that takes a user prompt and books a hotel reservation.
 * - BookHotelReservationFromPromptInput - The input type for the bookHotelReservationFromPrompt function.
 * - BookHotelReservationFromPromptOutput - The return type for the bookHotelReservationFromPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {findHotels, Hotel, HotelSearchCriteria} from '@/services/hotel-booking';
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service

const BookHotelReservationFromPromptInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the desired hotel reservation, including destination, dates, and preferences.'),
  userId: z.string().describe("The UID of the user making the request."), // Added userId
});
export type BookHotelReservationFromPromptInput = z.infer<typeof BookHotelReservationFromPromptInputSchema>;

// Update the output schema to include the dates and task ID
const BookHotelReservationFromPromptOutputSchema = z.object({
  hotelName: z.string().describe('The name of the hotel that was booked.'),
  confirmationNumber: z.string().describe('The confirmation number for the hotel reservation.'),
  checkInDate: z.string().date().optional().describe('The confirmed check-in date (YYYY-MM-DD).'),
  checkOutDate: z.string().date().optional().describe('The confirmed check-out date (YYYY-MM-DD).'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type BookHotelReservationFromPromptOutput = z.infer<typeof BookHotelReservationFromPromptOutputSchema>;

export async function bookHotelReservationFromPrompt(input: BookHotelReservationFromPromptInput): Promise<BookHotelReservationFromPromptOutput> {
   if (!input.userId) {
       throw new Error("User ID must be provided to book a hotel.");
   }
  return bookHotelReservationFromPromptFlow(input);
}

// Define the schema for the data we need the LLM to extract.
const LLMExtractedHotelSearchCriteriaSchema = z.object({
    city: z.string().describe('The city where the hotel is located.'),
    checkInDate: z.string().date().describe('The check-in date (YYYY-MM-DD).'),
    checkOutDate: z.string().date().describe('The check-out date (YYYY-MM-DD).'),
    numberOfGuests: z.number().int().describe('The number of guests (must be an integer).'),
});

// Define the final schema with all validations, used after LLM extraction
const FinalHotelSearchCriteriaSchema = LLMExtractedHotelSearchCriteriaSchema.extend({
    numberOfGuests: z.number().int().positive().describe('The number of guests (must be a positive integer).'),
});

const bookHotelPrompt = ai.definePrompt({
  name: 'bookHotelPrompt',
  input: {
     // Only prompt is needed for the LLM
     schema: BookHotelReservationFromPromptInputSchema.pick({ prompt: true }),
  },
  output: {
    schema: LLMExtractedHotelSearchCriteriaSchema,
  },
  prompt: `You are a hotel booking assistant. Your task is to extract the hotel search criteria from the following user prompt.

  Prompt: {{{prompt}}}

  Ensure you accurately extract the city, check-in date (YYYY-MM-DD), check-out date (YYYY-MM-DD), and the number of guests.
  Return ONLY the structured JSON output conforming to the schema. Do not add any extra commentary. If you cannot extract all required fields, explain the issue in the 'city' field and set dates/guests appropriately to indicate failure (e.g., use "Invalid date" or 0 for guests).`,
});


const bookHotelReservationFromPromptFlow = ai.defineFlow<
  typeof BookHotelReservationFromPromptInputSchema,
  typeof BookHotelReservationFromPromptOutputSchema
>({
  name: 'bookHotelReservationFromPromptFlow',
  inputSchema: BookHotelReservationFromPromptInputSchema,
  outputSchema: BookHotelReservationFromPromptOutputSchema,
},
async (input) => {
   const { userId, prompt } = input;
   let taskId: string | undefined = undefined;
   let searchCriteria: HotelSearchCriteria | null = null;
   let finalResult: BookHotelReservationFromPromptOutput;

  try {
      // 1. Run the prompt to extract search criteria.
      const llmResponse = await bookHotelPrompt({ prompt }); // Pass only prompt
      const extractedCriteria = llmResponse.output;

      if (!extractedCriteria) {
          throw new Error('AI failed to process the request. No hotel criteria were generated.');
      }
      if (typeof extractedCriteria !== 'object' || extractedCriteria === null) {
          console.error("LLM output was not a valid object:", extractedCriteria);
          throw new Error('AI response was not in the expected format (expected an object).');
      }

      // 2. Validate the extracted criteria.
      // Initial checks for explicit failure messages from LLM
      const city = extractedCriteria?.city?.toLowerCase();
      const checkIn = extractedCriteria?.checkInDate?.toLowerCase();
      const checkOut = extractedCriteria?.checkOutDate?.toLowerCase();
      if (city?.includes('issue') || city?.includes('invalid') || city?.includes('fail')) {
          throw new Error(`AI Processing Error: ${extractedCriteria.city}`);
      }
      if (checkIn?.includes('invalid') || checkOut?.includes('invalid')) {
          throw new Error('AI could not extract valid dates.');
      }

      // Full validation using Zod schema
      searchCriteria = FinalHotelSearchCriteriaSchema.parse(extractedCriteria);
      console.log("Validated Search Criteria:", searchCriteria);

      // 3. Find available hotels.
      const availableHotels = await findHotels(searchCriteria);
      if (!availableHotels || availableHotels.length === 0) {
        throw new Error(`No hotels found matching your criteria in ${searchCriteria.city} for the specified dates.`);
      }

      // 4. Select a hotel and simulate booking.
      const hotelToBook = availableHotels[0];
      console.log(`Simulating booking for: ${hotelToBook.name}`);
      const confirmationNumber = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 5. Save successful task to Firestore.
      const bookingDetails = {
          hotelName: hotelToBook.name,
          confirmationNumber: confirmationNumber,
          city: searchCriteria.city,
          checkInDate: searchCriteria.checkInDate,
          checkOutDate: searchCriteria.checkOutDate,
          numberOfGuests: searchCriteria.numberOfGuests,
          // Add hotel address/rating if needed:
          // address: hotelToBook.address,
          // rating: hotelToBook.rating,
      };
      taskId = await saveAgentTask({
          userId: userId,
          type: 'hotel',
          prompt: prompt,
          details: bookingDetails, // Save the search criteria and booking info
          status: 'confirmed',
          result: { confirmationNumber: confirmationNumber },
      });

      // 6. Return the successful result.
       finalResult = {
           hotelName: hotelToBook.name,
           confirmationNumber: confirmationNumber,
           checkInDate: searchCriteria.checkInDate,
           checkOutDate: searchCriteria.checkOutDate,
           taskId: taskId,
       };
       return finalResult;

    } catch (error: any) {
       console.error("Error in bookHotelReservationFromPromptFlow:", error);
       let errorMessage = 'An unexpected error occurred during hotel booking.';
       let status: 'failed' = 'failed';

       if (error instanceof z.ZodError) {
           errorMessage = `AI provided invalid search criteria: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`;
       } else if (error.message) {
           errorMessage = error.message;
           // Check if it's a "No hotels found" error to potentially set a different status or detail
           if (errorMessage.startsWith('No hotels found')) {
               // status = 'no_results'; // Or keep as 'failed'
           }
       }

        // Attempt to save failed task
       try {
           taskId = await saveAgentTask({
               userId: userId,
               type: 'hotel',
               prompt: prompt,
               details: searchCriteria || {}, // Save criteria if available
               status: status,
               error: errorMessage,
           });
       } catch (saveError) {
           console.error("Failed to save error task to Firestore:", saveError);
       }

       // Throw the error to be caught by the frontend caller
       throw new Error(errorMessage);
    }
});
