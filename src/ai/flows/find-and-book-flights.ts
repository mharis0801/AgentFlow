'use server';
/**
 * @fileOverview An AI agent for finding and booking flights based on user prompts.
 * Saves the flight details and result to Firestore.
 *
 * - findAndBookFlights - A function that handles the flight finding and booking process.
 * - FindAndBookFlightsInput - The input type for the findAndBookFlights function.
 * - FindAndBookFlightsOutput - The return type for the findAndBookFlights function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {Flight, FlightSearchCriteria, findFlights} from '@/services/flight-booking';
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service

const FindAndBookFlightsInputSchema = z.object({
  prompt: z
    .string()
    .describe(
      'A prompt describing the desired flight, including origin, destination, dates, and preferences (e.g., airline, price range).'
    ),
   userId: z.string().describe("The UID of the user making the request."), // Added userId
});
export type FindAndBookFlightsInput = z.infer<typeof FindAndBookFlightsInputSchema>;

const FindAndBookFlightsOutputSchema = z.object({
  flights: z.array(z.object({
    flightNumber: z.string(),
    departureAirport: z.string(),
    arrivalAirport: z.string(),
    departureTime: z.string(), // Keep as string from mock API
    arrivalTime: z.string(), // Keep as string from mock API
  })).describe('A list of flights that match the user prompt.'),
  bookingConfirmation: z.string().describe('A confirmation message for the booked flight.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type FindAndBookFlightsOutput = z.infer<typeof FindAndBookFlightsOutputSchema>;

export async function findAndBookFlights(input: FindAndBookFlightsInput): Promise<FindAndBookFlightsOutput> {
    if (!input.userId) {
        throw new Error("User ID must be provided to book flights.");
    }
  return findAndBookFlightsFlow(input);
}

// Define the schema for the data we need to extract
const FlightSearchCriteriaSchema = z.object({
    departureCity: z.string().describe('The departure city or airport code.'),
    arrivalCity: z.string().describe('The arrival city or airport code.'),
    departureDate: z.string().date().describe('The departure date (YYYY-MM-DD).'),
    numberOfPassengers: z.number().int().describe('The number of passengers (must be an integer).'),
});

const flightSearchPrompt = ai.definePrompt({
  name: 'flightSearchPrompt',
  input: {
    schema: FindAndBookFlightsInputSchema.pick({ prompt: true }), // Only need prompt for LLM
  },
  output: {
    schema: FlightSearchCriteriaSchema,
  },
  prompt: `You are an AI travel assistant. Your task is to extract the flight search criteria from the following user prompt.
  Extract the departure city/airport, arrival city/airport, departure date (in YYYY-MM-DD format), and the number of passengers.

  Prompt: {{{prompt}}}

  Return ONLY the structured JSON output conforming to the required schema. Do not add any extra commentary. If you cannot extract all required fields, explain the issue in the 'departureCity' field and set date/passengers appropriately to indicate failure (e.g., use 0 for passengers if not found).`,
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
     const { userId, prompt } = input;
     let taskId: string | undefined = undefined;
     let searchCriteria: FlightSearchCriteria | null = null;
     let finalResult: FindAndBookFlightsOutput;

     try {
         // 1. Run the prompt to extract search criteria.
         const llmResponse = await flightSearchPrompt({ prompt }); // Pass only prompt
         const extractedCriteria = llmResponse.output;

         // 2. Validate the extracted criteria.
         if (!extractedCriteria) {
             throw new Error('AI failed to process the request. No flight criteria were generated.');
         }
          // Check for failure indication from the prompt itself
         if (extractedCriteria.departureCity?.toLowerCase().includes('issue') || extractedCriteria.departureCity?.toLowerCase().includes('fail')) {
             throw new Error(`AI Processing Error: ${extractedCriteria.departureCity}`);
         }
         // Parse with the Zod schema
         searchCriteria = FlightSearchCriteriaSchema.parse(extractedCriteria);

         // Add post-extraction validation
         if (searchCriteria.numberOfPassengers <= 0) {
             throw new Error("Number of passengers must be a positive integer.");
         }
         console.log("Extracted Flight Search Criteria:", searchCriteria);

         // 3. Find available flights.
         const flights = await findFlights(searchCriteria);
         if (!flights || flights.length === 0) {
            throw new Error(`No flights found matching your criteria from ${searchCriteria.departureCity} to ${searchCriteria.arrivalCity} on ${searchCriteria.departureDate}.`);
         }

         // 4. Simulate booking the first available flight.
         const bookedFlight = flights[0];
         console.log(`Simulating booking for flight: ${bookedFlight.flightNumber}`);
         const bookingConfirmationMessage = `Flight ${bookedFlight.flightNumber} from ${bookedFlight.departureAirport} to ${bookedFlight.arrivalAirport} on ${searchCriteria.departureDate} for ${searchCriteria.numberOfPassengers} passenger(s) booked successfully (simulated).`;

         // 5. Save successful task to Firestore.
         const taskDetails = {
             ...searchCriteria, // Departure city, arrival city, date, passengers
             bookedFlight: bookedFlight, // Include details of the booked flight
         };
          taskId = await saveAgentTask({
              userId: userId,
              type: 'flight',
              prompt: prompt,
              details: taskDetails,
              status: 'confirmed', // Or 'booked'
              result: { bookingConfirmationMessage: bookingConfirmationMessage },
          });

         // 6. Return the successful result.
         finalResult = {
           flights: flights, // Return all found flights
           bookingConfirmation: bookingConfirmationMessage,
           taskId: taskId,
         };
         return finalResult;

     } catch (error: any) {
         console.error("Error in findAndBookFlightsFlow:", error);
         let errorMessage = 'An unexpected error occurred during flight booking.';
          let status: 'failed' = 'failed';

         if (error instanceof z.ZodError) {
             errorMessage = `AI provided invalid search criteria: ${error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ')}`;
         } else if (error.message) {
             errorMessage = error.message;
             if (errorMessage.startsWith('No flights found')) {
                 // status = 'no_results';
             }
         }

         // Attempt to save failed task
         try {
             taskId = await saveAgentTask({
                 userId: userId,
                 type: 'flight',
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
  }
);
