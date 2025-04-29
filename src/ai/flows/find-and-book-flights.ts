'use server';
/**
 * @fileOverview An AI agent for finding and booking flights based on user prompts.
 *
 * - findAndBookFlights - A function that handles the flight finding and booking process.
 * - FindAndBookFlightsInput - The input type for the findAndBookFlights function.
 * - FindAndBookFlightsOutput - The return type for the findAndBookFlights function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {Flight, FlightSearchCriteria, findFlights} from '@/services/flight-booking';

const FindAndBookFlightsInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A prompt describing the desired flight, including origin, destination, dates, and preferences (e.g., airline, price range).'
    ),
});
export type FindAndBookFlightsInput = z.infer<typeof FindAndBookFlightsInputSchema>;

const FindAndBookFlightsOutputSchema = z.object({
  flights: z.array(z.object({
    flightNumber: z.string(),
    departureAirport: z.string(),
    arrivalAirport: z.string(),
    departureTime: z.string(),
    arrivalTime: z.string(),
  })).describe('A list of flights that match the user prompt.'),
  bookingConfirmation: z.string().describe('A confirmation message for the booked flight.'),
});
export type FindAndBookFlightsOutput = z.infer<typeof FindAndBookFlightsOutputSchema>;

export async function findAndBookFlights(input: FindAndBookFlightsInput): Promise<FindAndBookFlightsOutput> {
  return findAndBookFlightsFlow(input);
}

const flightSearchPrompt = ai.definePrompt({
  name: 'flightSearchPrompt',
  input: {
    schema: z.object({
      prompt: z
        .string()
        .describe(
          'A prompt describing the desired flight, including origin, destination, dates, and preferences (e.g., airline, price range).'
        ),
    }),
  },
  output: {
    schema: z.object({
      departureCity: z.string().describe('The departure city.'),
      arrivalCity: z.string().describe('The arrival city.'),
      departureDate: z.string().describe('The departure date (YYYY-MM-DD).'),
      numberOfPassengers: z.number().describe('The number of passengers.'),
  }),
  },
  prompt: `You are an AI travel assistant. Extract the departure city, arrival city, departure date, and number of passengers from the following user prompt. Return the response as a JSON object.\n\nPrompt: {{{prompt}}}`,
});


const findAndBookFlightsFlow = ai.defineFlow<
  typeof FindAndBookFlightsInputSchema,
  typeof FindAndBookFlightsOutputSchema
>(
  {
    name: 'findAndBookFlightsFlow',
    inputSchema: FindAndBookFlightsInputSchema,
    outputSchema: FindAndBookFlightsOutputSchema,
  },
  async input => {
    const {output} = await flightSearchPrompt(input);

    const searchCriteria: FlightSearchCriteria = {
      departureCity: output!.departureCity,
      arrivalCity: output!.arrivalCity,
      departureDate: output!.departureDate,
      numberOfPassengers: output!.numberOfPassengers,
    };

    const flights: Flight[] = await findFlights(searchCriteria);

    // For simplicity, let's assume the user wants to book the first flight.
    const bookedFlight = flights[0];

    return {
      flights: flights,
      bookingConfirmation: `Flight ${bookedFlight.flightNumber} from ${bookedFlight.departureAirport} to ${bookedFlight.arrivalAirport} booked successfully.`, // Confirm booking
    };
  }
);

