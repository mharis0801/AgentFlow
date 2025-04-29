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

// Define the schema for the data we need to extract
const FlightSearchCriteriaSchema = z.object({
    departureCity: z.string().describe('The departure city or airport code.'),
    arrivalCity: z.string().describe('The arrival city or airport code.'),
    departureDate: z.string().date().describe('The departure date (YYYY-MM-DD).'), // Use .date() for validation
    numberOfPassengers: z.number().int().positive().describe('The number of passengers (must be a positive integer).'), // Add validation
});

const flightSearchPrompt = ai.definePrompt({
  name: 'flightSearchPrompt',
  input: {
    schema: FindAndBookFlightsInputSchema, // The input is the user's raw prompt
  },
  output: {
    // The output should conform to our defined FlightSearchCriteriaSchema
    schema: FlightSearchCriteriaSchema,
  },
  prompt: `You are an AI travel assistant. Your task is to extract the flight search criteria from the following user prompt.
  Extract the departure city/airport, arrival city/airport, departure date (in YYYY-MM-DD format), and the number of passengers.

  Prompt: {{{prompt}}}

  Return ONLY the structured JSON output conforming to the required schema. Do not add any extra commentary. If you cannot extract all required fields, explain the issue in the 'departureCity' field and set date/passengers appropriately to indicate failure.`,
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
  async (input) => {
    // 1. Run the prompt to extract search criteria.
    const llmResponse = await flightSearchPrompt(input);
    const extractedCriteria = llmResponse.output;

    // 2. Validate the extracted criteria.
    let searchCriteria: FlightSearchCriteria;
    if (!extractedCriteria) {
        throw new Error('AI failed to process the request. No flight criteria were generated.');
    }
    try {
        // Check for failure indication from the prompt itself
        if (extractedCriteria.departureCity?.includes('issue')) {
            throw new Error(`AI Processing Error: ${extractedCriteria.departureCity}`);
        }
        searchCriteria = FlightSearchCriteriaSchema.parse(extractedCriteria);
        console.log("Extracted Flight Search Criteria:", searchCriteria);
    } catch (error: any) {
        console.error("LLM provided invalid flight search criteria:", error);
        if (error instanceof z.ZodError) {
            throw new Error(`AI provided invalid search criteria: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`);
        }
        // Use the error message if it came from the failure check above
        throw new Error(error.message || "AI failed to extract valid flight search criteria.");
    }


    // 3. Find available flights using the extracted criteria.
    // In a real app, this would call an actual flight search API.
    let flights: Flight[];
    try {
      flights = await findFlights(searchCriteria);
    } catch (error: any) {
       console.error("Error finding flights:", error);
       throw new Error(`Failed to search for flights: ${error.message || 'Unknown error'}`);
    }


    if (!flights || flights.length === 0) {
      throw new Error(`No flights found matching your criteria from ${searchCriteria.departureCity} to ${searchCriteria.arrivalCity} on ${searchCriteria.departureDate}.`);
    }

    // 4. Simulate booking the first available flight.
    // In a real app, this would involve user selection and calling a booking API.
    const bookedFlight = flights[0];
    console.log(`Simulating booking for flight: ${bookedFlight.flightNumber}`);

    // Simulate booking confirmation. Replace with actual booking logic.
    const bookingConfirmationMessage = `Flight ${bookedFlight.flightNumber} from ${bookedFlight.departureAirport} to ${bookedFlight.arrivalAirport} on ${searchCriteria.departureDate} for ${searchCriteria.numberOfPassengers} passenger(s) booked successfully (simulated).`;

    // 5. Return the found flights and the confirmation message.
    return {
      flights: flights, // Return all found flights for potential display
      bookingConfirmation: bookingConfirmationMessage,
    };
  }
);
