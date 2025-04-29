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
import {findHotels, Hotel, HotelSearchCriteria} from '@/services/hotel-booking'; // Corrected import path

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

// Simplified Tool: Directly extract criteria needed for the next step.
// The LLM's primary role here is extraction based on the prompt.
const extractHotelSearchCriteriaTool = ai.defineTool({
  name: 'extractHotelSearchCriteria',
  description: 'Extracts key hotel search criteria (city, check-in/out dates, guests) from a user prompt.',
  inputSchema: z.object({
    prompt: z.string().describe('The user prompt to extract criteria from.'),
  }),
  outputSchema: z.object({
    city: z.string().describe('The city where the hotel is located.'),
    checkInDate: z.string().date().describe('The check-in date (YYYY-MM-DD).'), // Use .date() for validation
    checkOutDate: z.string().date().describe('The check-out date (YYYY-MM-DD).'), // Use .date() for validation
    numberOfGuests: z.number().int().positive().describe('The number of guests (must be a positive integer).'), // Add validation
  }),
},
async (input) => {
  // This tool is primarily for schema definition to guide the LLM output format.
  // It's not expected to be called directly in this flow version.
  throw new Error("This tool's implementation should not be called in this flow; its schema guides the LLM.");
});


const bookHotelPrompt = ai.definePrompt({
  name: 'bookHotelPrompt',
  // Provide the tool schema for the LLM to understand the desired output format.
  // Although we don't check toolRequests anymore, defining it here helps guide the LLM.
  tools: [extractHotelSearchCriteriaTool],
  input: {
    schema: BookHotelReservationFromPromptInputSchema,
  },
  output: {
    // The prompt's direct output is the structured search criteria.
    schema: extractHotelSearchCriteriaTool.outputSchema,
  },
  prompt: `You are a hotel booking assistant. Your task is to extract the hotel search criteria from the following user prompt.

  Prompt: {{{prompt}}}

  Ensure you accurately extract the city, check-in date (YYYY-MM-DD), check-out date (YYYY-MM-DD), and the number of guests.
  Return ONLY the structured JSON output required by the extractHotelSearchCriteria tool's output schema. Do not add any extra commentary. If you cannot extract all required fields, explain the issue in the 'city' field and set dates/guests appropriately to indicate failure (e.g., use "Invalid date" or 0 for guests).`,
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

  let searchCriteria: HotelSearchCriteria;
  try {
     // Check for failure indication from the prompt itself (e.g., in the city field)
     if (extractedCriteria.city?.toLowerCase().includes('issue') || extractedCriteria.city?.toLowerCase().includes('invalid') || extractedCriteria.city?.toLowerCase().includes('fail')) {
       throw new Error(`AI Processing Error: ${extractedCriteria.city}`);
     }
     // Check for potentially invalid dates/guests as per prompt instructions
     if (extractedCriteria.checkInDate?.toLowerCase().includes('invalid') || extractedCriteria.checkOutDate?.toLowerCase().includes('invalid') || extractedCriteria.numberOfGuests === 0) {
        throw new Error('AI could not extract valid dates or number of guests.');
     }

    // Validate the structure using the tool's *output* schema, as the prompt aims to produce this.
    searchCriteria = extractHotelSearchCriteriaTool.outputSchema.parse(extractedCriteria);
    console.log("Extracted Search Criteria:", searchCriteria);
  } catch (error: any) {
    console.error("LLM provided invalid search criteria:", error);
    if (error instanceof z.ZodError) {
        throw new Error(`AI provided invalid search criteria: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`);
    }
    // Use the error message if it came from the checks above or parsing
    throw new Error(error.message || "AI failed to extract valid search criteria.");
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
