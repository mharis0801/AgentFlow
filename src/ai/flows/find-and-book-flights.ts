'use server';
/**
 * @fileOverview An AI agent for finding and booking flights based on structured user input.
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

// Define the structured input schema for the form
const FindAndBookFlightsInputSchema = z.object({
    departureCity: z.string().min(1, { message: "Departure city is required." }).describe('The departure city or airport code.'),
    arrivalCity: z.string().min(1, { message: "Arrival city is required." }).describe('The arrival city or airport code.'),
    departureDate: z.string().date('Invalid departure date format. Use YYYY-MM-DD.').describe('The departure date (YYYY-MM-DD).'),
    numberOfPassengers: z.number().int().positive({ message: 'Number of passengers must be positive.' }).describe('The number of passengers (must be a positive integer).'),
    userId: z.string().describe("The UID of the user making the request."),
});
export type FindAndBookFlightsInput = z.infer<typeof FindAndBookFlightsInputSchema>;

// Output schema remains the same
const FindAndBookFlightsOutputSchema = z.object({
  flights: z.array(z.object({
    flightNumber: z.string(),
    departureAirport: z.string(),
    arrivalAirport: z.string(),
    departureTime: z.string(), // Keep as string from mock API
    arrivalTime: z.string(), // Keep as string from mock API
  })).describe('A list of flights that match the user criteria.'),
  bookingConfirmation: z.string().describe('A confirmation message for the booked flight.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type FindAndBookFlightsOutput = z.infer<typeof FindAndBookFlightsOutputSchema>;

// Renamed function to reflect structured input
export async function findAndBookFlights(input: FindAndBookFlightsInput): Promise<FindAndBookFlightsOutput> {
    if (!input.userId) {
        throw new Error("User ID must be provided to book flights.");
    }
    // Validate input using Zod before proceeding
    const validationResult = FindAndBookFlightsInputSchema.safeParse(input);
    if (!validationResult.success) {
        const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        throw new Error(`Invalid input: ${errorMessage}`);
    }
    return findAndBookFlightsFlow(validationResult.data); // Pass validated data
}


// Define the flow using the structured input
const findAndBookFlightsFlow = ai.defineFlow<
  typeof FindAndBookFlightsInputSchema,
  typeof FindAndBookFlightsOutputSchema
>(
  {
    name: 'findAndBookFlightsFlow', // Renamed flow
    inputSchema: FindAndBookFlightsInputSchema,
    outputSchema: FindAndBookFlightsOutputSchema,
  },
  async (input) => {
     const { userId, ...searchCriteria } = input; // Directly use input as search criteria
     let taskId: string | undefined = undefined;
     let finalResult: FindAndBookFlightsOutput;

     try {
         // Input is already validated by the calling function
         console.log("Validated Flight Search Criteria:", searchCriteria);

         // 1. Find available flights using the mock service.
         const flights = await findFlights(searchCriteria);
         if (!flights || flights.length === 0) {
            throw new Error(`No flights found matching your criteria from ${searchCriteria.departureCity} to ${searchCriteria.arrivalCity} on ${searchCriteria.departureDate}.`);
         }

         // 2. Simulate booking the first available flight.
         const bookedFlight = flights[0]; // Book the first result for simplicity
         console.log(`Simulating booking for flight: ${bookedFlight.flightNumber}`);
         const bookingConfirmationMessage = `Flight ${bookedFlight.flightNumber} from ${bookedFlight.departureAirport} to ${bookedFlight.arrivalAirport} on ${searchCriteria.departureDate} for ${searchCriteria.numberOfPassengers} passenger(s) booked successfully (simulated).`;

         // 3. Save successful task to Firestore.
         const taskDetails = {
             ...searchCriteria, // Departure city, arrival city, date, passengers
             // Include details of the actual booked flight
             bookedFlight: {
                 flightNumber: bookedFlight.flightNumber,
                 departureAirport: bookedFlight.departureAirport,
                 arrivalAirport: bookedFlight.arrivalAirport,
                 departureTime: bookedFlight.departureTime, // Store time as string for now
                 arrivalTime: bookedFlight.arrivalTime, // Store time as string for now
             },
         };
          taskId = await saveAgentTask({
              userId: userId,
              type: 'flight',
              // prompt: prompt, // Remove prompt
              details: taskDetails,
              status: 'confirmed', // Or 'booked'
              result: { bookingConfirmationMessage: bookingConfirmationMessage },
          });

         // 4. Return the successful result.
         finalResult = {
           flights: flights, // Return all found flights as options
           bookingConfirmation: bookingConfirmationMessage,
           taskId: taskId,
         };
         return finalResult;

     } catch (error: any) {
         console.error("Error in findAndBookFlightsFlow:", error);
         let errorMessage = 'An unexpected error occurred during flight booking.';
          let status: 'failed' = 'failed';

         if (error.message) {
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
                 // prompt: prompt, // Removed prompt
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
