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

const extractHotelSearchCriteria = ai.defineTool({
  name: 'extractHotelSearchCriteria',
  description: 'Extracts hotel search criteria from a user prompt.',
  inputSchema: z.object({
    prompt: z.string().describe('The user prompt to extract criteria from.'),
  }),
  outputSchema: z.object({
    city: z.string().describe('The city where the hotel is located.'),
    checkInDate: z.string().describe('The check-in date (YYYY-MM-DD).'),
    checkOutDate: z.string().describe('The check-out date (YYYY-MM-DD).'),
    numberOfGuests: z.number().describe('The number of guests.'),
  }),
},
async input => {
    // TODO: Implement the logic to extract hotel search criteria from the prompt.
    // This is a placeholder implementation that returns dummy data.
    return {
      city: 'Example City',
      checkInDate: '2024-01-01',
      checkOutDate: '2024-01-05',
      numberOfGuests: 2,
    };
  }
);

const bookHotelPrompt = ai.definePrompt({
  name: 'bookHotelPrompt',
  tools: [extractHotelSearchCriteria],
  input: {
    schema: z.object({
      prompt: z.string().describe('A prompt describing the desired hotel reservation, including destination, dates, and preferences.'),
    }),
  },
  output: {
    schema: z.object({
      hotelName: z.string().describe('The name of the hotel that was booked.'),
      confirmationNumber: z.string().describe('The confirmation number for the hotel reservation.'),
    }),
  },
  prompt: `You are a hotel booking assistant. Extract the hotel search criteria from the following prompt using the extractHotelSearchCriteria tool.
  Then find a hotel and generate a confirmation number.

  Prompt: {{{prompt}}}
  `,
});

const bookHotelReservationFromPromptFlow = ai.defineFlow<
  typeof BookHotelReservationFromPromptInputSchema,
  typeof BookHotelReservationFromPromptOutputSchema
>({
  name: 'bookHotelReservationFromPromptFlow',
  inputSchema: BookHotelReservationFromPromptInputSchema,
  outputSchema: BookHotelReservationFromPromptOutputSchema,
},
async input => {
  const { output } = await bookHotelPrompt(input);
  // TODO: Implement the logic to book the hotel reservation using an API.
  // This is a placeholder implementation that returns dummy data.
  return {
    hotelName: output!.hotelName,
    confirmationNumber: output!.confirmationNumber,
  };
});

