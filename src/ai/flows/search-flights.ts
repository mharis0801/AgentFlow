
'use server';
/**
 * @fileOverview An AI agent for finding flights based on structured user input.
 * Uses the simulated `searchFlightsAPI` service.
 * Saves the flight search task details and status to Firestore.
 *
 * - searchFlights - A function that handles the flight finding process.
 * - SearchFlightsInput - The input type for the searchFlights function.
 * - SearchFlightsOutput - The return type for the searchFlights function (an array of flights).
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {Flight, FlightSearchCriteria, searchFlightsAPI} from '@/services/flight-booking'; // Import simulated API service
import { saveAgentTask, updateAgentTask, AgentTaskPayload } from '@/services/firestore'; // Import Firestore service

// Define the structured input schema for the form
const SearchFlightsInputSchema = z.object({
    departureCity: z.string().min(1, { message: "Departure city is required." }).describe('The departure city or airport code.'),
    arrivalCity: z.string().min(1, { message: "Arrival city is required." }).describe('The arrival city or airport code.'),
    departureDate: z.string().date('Invalid departure date format. Use YYYY-MM-DD.').describe('The departure date (YYYY-MM-DD).'),
    numberOfPassengers: z.number().int().positive({ message: 'Number of passengers must be positive.' }).describe('The number of passengers (must be a positive integer).'),
    userId: z.string().describe("The UID of the user making the request."),
});
export type SearchFlightsInput = z.infer<typeof SearchFlightsInputSchema>;

// Define the structure for a flight result in the output
const FlightResultSchema = z.object({
    id: z.string(),
    airline: z.string(),
    flightNumber: z.string(),
    departureAirport: z.string(),
    arrivalAirport: z.string(),
    departureTime: z.string().datetime(),
    arrivalTime: z.string().datetime(),
    durationMinutes: z.number(),
    priceUSD: z.number(),
    bookingUrl: z.string().url().optional().describe("A deep link to book this flight on the provider site (if available).")
});

// Output schema is an array of flight results
const SearchFlightsOutputSchema = z.array(FlightResultSchema).describe("A list of available flights matching the search criteria.");
export type SearchFlightsOutput = z.infer<typeof SearchFlightsOutputSchema>;

// Entry function called by the frontend
export async function searchFlights(input: SearchFlightsInput): Promise<SearchFlightsOutput> {
    if (!input.userId) {
        throw new Error("User ID must be provided to search for flights.");
    }
    // Validate input using Zod before proceeding
    const validationResult = SearchFlightsInputSchema.safeParse(input);
    if (!validationResult.success) {
        const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
        throw new Error(`Invalid input: ${errorMessage}`);
    }
    return searchFlightsFlow(validationResult.data); // Pass validated data
}

// Define the flow for searching flights
const searchFlightsFlow = ai.defineFlow<
  typeof SearchFlightsInputSchema,
  typeof SearchFlightsOutputSchema
>(
  {
    name: 'searchFlightsFlow',
    inputSchema: SearchFlightsInputSchema,
    outputSchema: SearchFlightsOutputSchema,
  },
  async (input) => {
     const { userId, ...searchCriteria } = input; // Directly use validated input as search criteria
     let taskId: string | undefined = undefined;
     let initialTaskSaved = false;

     // 1. Save initial pending task to Firestore
     const initialTaskPayload: Omit<AgentTaskPayload, 'createdAt' | 'updatedAt' | 'result' | 'error'> = {
            userId: userId,
            type: 'flight', // Keep type as 'flight'
            details: { searchCriteria }, // Store the search criteria
            status: 'pending', // Start as pending
     };
     try {
         taskId = await saveAgentTask(initialTaskPayload);
         initialTaskSaved = true;
         console.log(`Initial pending flight search task saved with ID: ${taskId}`);
     } catch (saveError: any) {
         console.error("Failed to save initial pending flight search task (Original Error):", saveError);
         throw new Error(`Failed to initiate flight search task: ${saveError.message || 'Could not save agent task to database.'}`);
     }

    // Helper function to update task status on failure/completion
    const updateTaskStatus = async (status: AgentTaskPayload['status'], errorMsg?: string | null, resultData?: Record<string, any> | null ) => {
         if (taskId) {
             try {
                const updates: Partial<Pick<AgentTaskPayload, 'status' | 'result' | 'error'>> = { status };
                if (errorMsg !== undefined) updates.error = errorMsg;
                if (resultData !== undefined) updates.result = resultData;

                 await updateAgentTask(taskId, updates);
                 console.log(`Flight search task ${taskId} updated to ${status}.`);
             } catch (updateError: any) {
                 console.error(`Failed to update task ${taskId} to ${status} status:`, updateError);
             }
         } else {
             console.error("Cannot update task status: taskId is undefined.");
         }
     };

     try {
         // 2. Find available flights using the simulated API service.
         console.log("Searching for flights via API with criteria:", searchCriteria);
         const availableFlights = await searchFlightsAPI(searchCriteria); // Call the service function

          if (!availableFlights) { // Handle cases where the API might return null/undefined on error
              const apiErrorMsg = "Flight search API did not return results.";
              await updateTaskStatus('failed', apiErrorMsg);
              throw new Error(apiErrorMsg);
          }

         console.log(`Found ${availableFlights.length} potential flights.`);

         // 3. Update task in Firestore to 'completed'.
         await updateTaskStatus('completed', null, { resultsFound: availableFlights.length }); // Mark task as completed, store result count

         // 4. Return the successful result (list of flights) to the frontend.
         return availableFlights;

     } catch (error: any) {
         console.error("Error in searchFlightsFlow:", error);
         // Ensure the task is marked as failed if an error occurred after initial save
         const errorMessage = error.message || 'An unexpected error occurred during flight search.';
         if (initialTaskSaved && taskId) { // Only update if task was initially saved
            await updateTaskStatus('failed', errorMessage);
         }
         // Re-throw the error to be caught by the frontend caller
         throw error; // Throw the original error object
     }
  }
);

