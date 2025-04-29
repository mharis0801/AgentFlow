'use server';
/**
 * @fileOverview An AI agent for finding and booking flights based on structured user input.
 * Uses the simulated `findFlights` and `bookFlight` services.
 * Saves the flight details and result to Firestore.
 *
 * - findAndBookFlights - A function that handles the flight finding and booking process.
 * - FindAndBookFlightsInput - The input type for the findAndBookFlights function.
 * - FindAndBookFlightsOutput - The return type for the findAndBookFlights function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {Flight, FlightSearchCriteria, findFlights, bookFlight} from '@/services/flight-booking'; // Import simulated services
import { saveAgentTask, updateAgentTask } from '@/services/firestore'; // Import Firestore service

// Define the structured input schema for the form
const FindAndBookFlightsInputSchema = z.object({
    departureCity: z.string().min(1, { message: "Departure city is required." }).describe('The departure city or airport code.'),
    arrivalCity: z.string().min(1, { message: "Arrival city is required." }).describe('The arrival city or airport code.'),
    departureDate: z.string().date('Invalid departure date format. Use YYYY-MM-DD.').describe('The departure date (YYYY-MM-DD).'),
    numberOfPassengers: z.number().int().positive({ message: 'Number of passengers must be positive.' }).describe('The number of passengers (must be a positive integer).'),
    userId: z.string().describe("The UID of the user making the request."),
});
export type FindAndBookFlightsInput = z.infer<typeof FindAndBookFlightsInputSchema>;

// Define the structure for a booked flight in the output
const BookedFlightSchema = z.object({
    id: z.string(),
    airline: z.string(),
    flightNumber: z.string(),
    departureAirport: z.string(),
    arrivalAirport: z.string(),
    departureTime: z.string().datetime(),
    arrivalTime: z.string().datetime(),
    durationMinutes: z.number(),
    priceUSD: z.number(),
});

// Output schema includes the booked flight details and task ID
const FindAndBookFlightsOutputSchema = z.object({
  bookedFlight: BookedFlightSchema.describe('The details of the flight that was booked.'),
  confirmationNumber: z.string().describe('The confirmation number for the flight booking.'),
  bookingMessage: z.string().describe('A confirmation message summarizing the booking.'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type FindAndBookFlightsOutput = z.infer<typeof FindAndBookFlightsOutputSchema>;

// Entry function called by the frontend
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
    name: 'findAndBookFlightsFlow',
    inputSchema: FindAndBookFlightsInputSchema,
    outputSchema: FindAndBookFlightsOutputSchema,
  },
  async (input) => {
     const { userId, ...searchCriteria } = input; // Directly use validated input as search criteria
     let taskId: string | undefined = undefined;
     let initialTaskSaved = false;

     // 1. Save initial pending task to Firestore
     try {
         taskId = await saveAgentTask({
             userId: userId,
             type: 'flight',
             details: searchCriteria,
             status: 'pending', // Start as pending
         });
         initialTaskSaved = true;
         console.log(`Initial pending flight task saved with ID: ${taskId}`);
     } catch (saveError: any) {
         console.error("Failed to save initial pending flight task:", saveError);
         throw new Error(`Failed to initiate flight booking task: ${saveError.message}`);
     }

     // Helper function to update task status on failure
     const updateTaskToFailed = async (errorMsg: string) => {
         if (taskId) {
             try {
                 await updateAgentTask(taskId, { status: 'failed', error: errorMsg });
                 console.log(`Flight task ${taskId} updated to failed.`);
             } catch (updateError) {
                 console.error(`Failed to update task ${taskId} to failed status:`, updateError);
             }
         }
     };

     try {
         // 2. Find available flights using the simulated service.
         console.log("Searching for flights with criteria:", searchCriteria);
         const availableFlights = await findFlights(searchCriteria);

         if (!availableFlights || availableFlights.length === 0) {
            const noFlightsMsg = `No flights found matching your criteria from ${searchCriteria.departureCity} to ${searchCriteria.arrivalCity} on ${searchCriteria.departureDate}.`;
            await updateTaskToFailed(noFlightsMsg);
            throw new Error(noFlightsMsg);
         }
         console.log(`Found ${availableFlights.length} potential flights.`);

         // 3. Select a flight to book (simulate booking the first/cheapest result).
         //    A real AI might consider price, duration, airline preference, etc.
         const flightToBook = availableFlights.sort((a, b) => a.priceUSD - b.priceUSD)[0]; // Simple selection: cheapest
         console.log(`Attempting to book flight: ${flightToBook.flightNumber} (${flightToBook.airline})`);

         // Update task details with chosen flight before booking attempt
         if (taskId) {
             await updateAgentTask(taskId, {
                 details: { ...searchCriteria, chosenFlight: flightToBook },
                 status: 'processing' // Indicate booking attempt
             });
         }

         // 4. Call the simulated booking service.
         const bookingResult = await bookFlight(flightToBook, searchCriteria.numberOfPassengers);

         // 5. Handle booking result.
         if (!bookingResult.success || !bookingResult.confirmationNumber) {
             console.error(`Simulated flight booking failed for ${flightToBook.flightNumber}: ${bookingResult.message}`);
             await updateTaskToFailed(bookingResult.message);
             throw new Error(bookingResult.message); // Throw error to frontend
         }

         // 6. Booking successful - Update task in Firestore to 'confirmed'.
         const finalDetails = {
             ...searchCriteria, // Include original search criteria
             bookedFlightDetails: flightToBook, // Add all details of the booked flight
             confirmationNumber: bookingResult.confirmationNumber,
         };
         if (taskId) {
             await updateAgentTask(taskId, {
                 status: 'confirmed',
                 details: finalDetails,
                 result: { confirmationNumber: bookingResult.confirmationNumber, message: bookingResult.message },
                 error: null, // Clear any previous error
             });
             console.log(`Flight task ${taskId} updated to confirmed.`);
         }

         // 7. Return the successful result to the frontend.
         const finalResult: FindAndBookFlightsOutput = {
             bookedFlight: flightToBook,
             confirmationNumber: bookingResult.confirmationNumber,
             bookingMessage: bookingResult.message,
             taskId: taskId,
         };
         return finalResult;

     } catch (error: any) {
         console.error("Error in findAndBookFlightsFlow:", error);
         // Ensure the task is marked as failed if an error occurred after initial save
         if (initialTaskSaved) {
             await updateTaskToFailed(error.message || 'An unexpected error occurred during flight booking.');
         }
         // Re-throw the error to be caught by the frontend caller
         throw error; // Throw the original error object
     }
  }
);
