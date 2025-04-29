'use server';
/**
 * @fileOverview This file defines a Genkit flow for booking hotel reservations based on user prompts.
 *
 * - bookHotelReservationFromPrompt - A function that takes a user prompt and books a hotel reservation.
 * - BookHotelReservationFromPromptInput - The input type for the bookHotelReservationFromPrompt function.
 * - BookHotelReservationFromPromptOutput - The return type for the bookHotelReservationFromPrompt function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {findHotels, Hotel, HotelSearchCriteria} from '@/services/hotel-booking';

const BookHotelReservationFromPromptInputSchema = z.object({
  prompt: z.string().describe('A prompt describing the desired hotel reservation, including destination, dates, and preferences.'),
});
export type BookHotelReservationFromPromptInput = z.infer<typeof BookHotelReservationFromPromptInputSchema>;

const BookHotelReservationFromPromptOutputSchema = z.object({
  hotelName: z.string().describe('The name of the hotel that was booked.'),
  confirmationNumber: z.string().describe('The confirmation number for the hotel reservation.'),
});
export type BookHotelReservationFromPromptOutput = z.infer<typeof BookHotelReservationFromPromptOutputSchema>;

export async function bookHotelReservationFromPrompt(input: BookHotelReservationFromPromptInput): Promise<BookHotelReservationFromPromptOutput> {
  return bookHotelReservationFromPromptFlow(input);
}

// Define the expected output schema for the LLM, based on the HotelSearchCriteria
const HotelSearchCriteriaSchema = z.object({
    city: z.string().describe('The city where the hotel is located.'),
    checkInDate: z.string().date().describe('The check-in date (YYYY-MM-DD).'),
    checkOutDate: z.string().date().describe('The check-out date (YYYY-MM-DD).'),
    numberOfGuests: z.number().int().positive().describe('The number of guests (must be a positive integer).'),
});


const bookHotelPrompt = ai.definePrompt({
  name: 'bookHotelPrompt',
  input: {
    schema: BookHotelReservationFromPromptInputSchema,
  },
  output: {
    // The prompt's direct output should be the structured search criteria.
    schema: HotelSearchCriteriaSchema,
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
  // 1. Run the prompt to extract search criteria directly into the output.
  const llmResponse = await bookHotelPrompt(input);
  const extractedCriteria = llmResponse.output;

  // 2. Validate the extracted criteria directly from the output.
  if (!extractedCriteria) {
      throw new Error('AI failed to process the request. No hotel criteria were generated.');
  }

  // Ensure extractedCriteria is an object before trying to parse or access properties
  if (typeof extractedCriteria !== 'object' || extractedCriteria === null) {
      console.error("LLM output was not a valid object:", extractedCriteria);
      throw new Error('AI response was not in the expected format (expected an object).');
  }

  let searchCriteria: HotelSearchCriteria;
  try {
     // Check for failure indication from the prompt itself (e.g., in the city field)
     // Use optional chaining just in case the fields aren't present
     const city = extractedCriteria?.city?.toLowerCase();
     const checkIn = extractedCriteria?.checkInDate?.toLowerCase();
     const checkOut = extractedCriteria?.checkOutDate?.toLowerCase();
     const guests = extractedCriteria?.numberOfGuests;

     if (city?.includes('issue') || city?.includes('invalid') || city?.includes('fail')) {
       throw new Error(`AI Processing Error: ${extractedCriteria.city}`);
     }
     // Check for potentially invalid dates/guests as per prompt instructions
     if (checkIn?.includes('invalid') || checkOut?.includes('invalid') || guests === 0) {
        throw new Error('AI could not extract valid dates or number of guests.');
     }

    // Validate the structure using the defined HotelSearchCriteriaSchema.
    searchCriteria = HotelSearchCriteriaSchema.parse(extractedCriteria);
    console.log("Extracted Search Criteria:", searchCriteria);
  } catch (error: any) {
    console.error("LLM provided invalid search criteria:", error); // Log the full error object
    if (error instanceof z.ZodError) {
        // Format Zod errors for clarity
        const formattedErrors = error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        throw new Error(`AI provided invalid search criteria: ${formattedErrors}`);
    }
    // Improved fallback for other error types
    const errorMessage = error?.message || JSON.stringify(error) || 'Unknown error during criteria validation.';
    throw new Error(`AI failed to extract valid search criteria: ${errorMessage}`);
  }

  // 3. Find available hotels (using the mock service for now).
  // In a real app, call the actual hotel search API here.
  const availableHotels = await findHotels(searchCriteria);

  if (!availableHotels || availableHotels.length === 0) {
    throw new Error(`No hotels found matching your criteria in ${searchCriteria.city} for the specified dates.`);
  }

  // 4. Select a hotel (e.g., the first one) and simulate booking.
  // In a real app, call the booking API here.
  const hotelToBook = availableHotels[0];
  console.log(`Simulating booking for: ${hotelToBook.name}`);

  // Simulate booking confirmation
  const confirmationNumber = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 5. Return the booking details.
  return {
    hotelName: hotelToBook.name,
    confirmationNumber: confirmationNumber,
  };
});
