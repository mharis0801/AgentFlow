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
  // In a real scenario, this tool would use an LLM or NLP logic
  // to reliably extract the details from the input.prompt.
  // The current LLM prompt will handle this extraction.
  // This tool definition provides the structure/schema for the LLM.
  throw new Error("This tool should not be called directly; its schema is used by the LLM.");
});


const bookHotelPrompt = ai.definePrompt({
  name: 'bookHotelPrompt',
  // Provide the tool for the LLM to use for extraction.
  tools: [extractHotelSearchCriteriaTool],
  input: {
    schema: BookHotelReservationFromPromptInputSchema,
  },
  output: {
    // The prompt's direct output is now the structured search criteria.
    // The flow will handle the booking step after getting this output.
    schema: extractHotelSearchCriteriaTool.outputSchema,
  },
  prompt: `You are a hotel booking assistant. Your task is to extract the hotel search criteria from the following user prompt using the mandatory extractHotelSearchCriteria tool.

  Prompt: {{{prompt}}}

  Ensure you accurately extract the city, check-in date (YYYY-MM-DD), check-out date (YYYY-MM-DD), and the number of guests.
  Return ONLY the structured JSON output required by the extractHotelSearchCriteria tool. Do not add any extra commentary. If you cannot extract all required fields, explain the issue in the 'city' field and set dates/guests appropriately to indicate failure.`,
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
  // 1. Run the prompt to extract search criteria using the tool.
  const llmResponse = await bookHotelPrompt(input);

  // 2. Check if the LLM requested the tool and get the extracted criteria.
  const toolRequest = llmResponse.toolRequests(extractHotelSearchCriteriaTool.name)[0];

  if (!toolRequest) {
     // If the tool wasn't requested, the LLM likely couldn't extract the data.
     // Check if the LLM provided an explanation in its direct output (if any)
     const directOutput = llmResponse.output;
     let errorMessage = 'AI failed to understand the hotel request. Could not extract necessary details (city, dates, guests).';
     if (directOutput?.city && typeof directOutput.city === 'string' && directOutput.city.includes('issue')) {
        errorMessage = `AI Processing Error: ${directOutput.city}`; // Use LLM's explanation if provided as per prompt instructions
     } else if (llmResponse.text()) {
        errorMessage = `AI Response: ${llmResponse.text()}`; // Fallback to raw text response
     }
     console.error("LLM did not request the extraction tool.", llmResponse);
     throw new Error(errorMessage);
  }

  // 3. Validate the input extracted by the LLM using the tool's schema.
  let searchCriteria: HotelSearchCriteria;
  try {
    searchCriteria = extractHotelSearchCriteriaTool.outputSchema.parse(toolRequest.input);
    console.log("Extracted Search Criteria:", searchCriteria);
  } catch (error: any) {
    console.error("LLM provided invalid search criteria:", error);
    if (error instanceof z.ZodError) {
        throw new Error(`AI provided invalid search criteria: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`);
    }
    throw new Error("AI failed to extract valid search criteria.");
  }

  // 4. Find available hotels (using the mock service for now).
  // In a real app, call the actual hotel search API here.
  const availableHotels = await findHotels(searchCriteria);

  if (!availableHotels || availableHotels.length === 0) {
    throw new Error(`No hotels found matching your criteria in ${searchCriteria.city} for the specified dates.`);
  }

  // 5. Select a hotel (e.g., the first one) and simulate booking.
  // In a real app, call the booking API here.
  const hotelToBook = availableHotels[0];
  console.log(`Simulating booking for: ${hotelToBook.name}`);

  // Simulate booking confirmation
  const confirmationNumber = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  // 6. Return the booking details.
  return {
    hotelName: hotelToBook.name,
    confirmationNumber: confirmationNumber,
  };
});
