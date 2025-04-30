
'use server';
/**
 * @fileOverview This file defines a Genkit flow for searching hotel availability based on structured user input.
 * Uses the simulated `searchHotelsAPI` service.
 * Saves the search task details and status to Firestore.
 *
 * - searchHotels - A function that takes structured hotel search criteria and returns a list of available hotels.
 * - SearchHotelsInput - The input type for the searchHotels function.
 * - SearchHotelsOutput - The return type for the searchHotels function (an array of hotels).
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { searchHotelsAPI, Hotel, HotelSearchCriteria} from '@/services/hotel-booking'; // Import simulated API service
import { saveAgentTask, updateAgentTask, AgentTaskPayload } from '@/services/firestore'; // Import Firestore service

// Define the structured input schema for the search form
const SearchHotelsInputSchema = z.object({
  city: z.string().min(1, { message: 'City is required.' }).describe('The city where the hotel is located.'),
  checkInDate: z.string().date('Invalid check-in date format. Use YYYY-MM-DD.').describe('The check-in date (YYYY-MM-DD).'),
  checkOutDate: z.string().date('Invalid check-out date format. Use YYYY-MM-DD.').describe('The check-out date (YYYY-MM-DD).'),
  numberOfGuests: z.number().int().positive({ message: 'Number of guests must be positive.' }).describe('The number of guests (must be a positive integer).'),
  userId: z.string().describe("The UID of the user making the request."),
}).refine(data => new Date(data.checkInDate) < new Date(data.checkOutDate), {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"],
});
export type SearchHotelsInput = z.infer<typeof SearchHotelsInputSchema>;

// Output schema is an array of Hotel objects
const SearchHotelsOutputSchema = z.array(z.object({
    id: z.string(),
    name: z.string(),
    address: z.string(),
    rating: z.number(),
    description: z.string(),
    pricePerNightUSD: z.number(),
    imageUrl: z.string().url(),
    bookingUrl: z.string().url().optional().describe("A deep link to the hotel's booking page on the provider site (if available).")
})).describe("A list of available hotels matching the search criteria.");

export type SearchHotelsOutput = z.infer<typeof SearchHotelsOutputSchema>;

// Entry function called by the frontend
export async function searchHotels(input: SearchHotelsInput): Promise<SearchHotelsOutput> {
   if (!input.userId) {
       throw new Error("User ID must be provided to search for hotels.");
   }
   // Validate input using Zod before proceeding
   const validationResult = SearchHotelsInputSchema.safeParse(input);
   if (!validationResult.success) {
       const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
       throw new Error(`Invalid input: ${errorMessage}`);
   }
  return searchHotelsFlow(validationResult.data); // Pass validated data
}

// Define the flow for searching hotels
const searchHotelsFlow = ai.defineFlow<
  typeof SearchHotelsInputSchema,
  typeof SearchHotelsOutputSchema
>({
  name: 'searchHotelsFlow',
  inputSchema: SearchHotelsInputSchema,
  outputSchema: SearchHotelsOutputSchema,
},
async (input) => {
   const { userId, ...searchCriteria } = input; // Directly use validated input as search criteria
   let taskId: string | undefined = undefined;
   let initialTaskSaved = false;

   // 1. Save initial pending task to Firestore
   const initialTaskPayload: Omit<AgentTaskPayload, 'createdAt' | 'updatedAt' | 'result' | 'error'> = {
       userId: userId,
       type: 'hotel', // Keep type as 'hotel'
       details: { searchCriteria }, // Store the search criteria
       status: 'pending', // Start as pending
   };
   try {
       taskId = await saveAgentTask(initialTaskPayload);
       initialTaskSaved = true;
       console.log(`Initial pending hotel search task saved with ID: ${taskId}`);
   } catch (saveError: any) {
       console.error("Failed to save initial pending hotel search task (Original Error):", saveError);
       throw new Error(`Failed to initiate hotel search task: ${saveError.message || 'Could not save agent task to database.'}`);
   }

   // Helper function to update task status on failure/completion
   const updateTaskStatus = async (status: AgentTaskPayload['status'], errorMsg?: string | null, resultData?: Record<string, any> | null ) => {
       if (taskId) {
           try {
                const updates: Partial<Pick<AgentTaskPayload, 'status' | 'result' | 'error'>> = { status };
                if (errorMsg !== undefined) updates.error = errorMsg;
                if (resultData !== undefined) updates.result = resultData;

               await updateAgentTask(taskId, updates);
               console.log(`Hotel search task ${taskId} updated to ${status}.`);
           } catch (updateError: any) {
               console.error(`Failed to update task ${taskId} to ${status} status:`, updateError);
           }
       } else {
            console.error("Cannot update task status: taskId is undefined.");
       }
   };

   try {
       // 2. Find available hotels using the simulated API service.
       console.log("Searching for hotels via API with criteria:", searchCriteria);
       const availableHotels = await searchHotelsAPI(searchCriteria); // Call the service function

       if (!availableHotels) { // Handle cases where the API might return null/undefined on error
           const apiErrorMsg = "Hotel search API did not return results.";
           await updateTaskStatus('failed', apiErrorMsg);
           throw new Error(apiErrorMsg);
       }

       console.log(`Found ${availableHotels.length} potential hotels.`);

       // 3. Update task in Firestore to 'completed'.
       await updateTaskStatus('completed', null, { resultsFound: availableHotels.length }); // Mark task as completed, store result count

       // 4. Return the successful result (list of hotels) to the frontend.
       return availableHotels;

   } catch (error: any) {
       console.error("Error in searchHotelsFlow:", error);
       // Ensure the task is marked as failed if an error occurred after initial save
       const errorMessage = error.message || 'An unexpected error occurred during hotel search.';
       if (initialTaskSaved && taskId) { // Only update if task was initially saved
            await updateTaskStatus('failed', errorMessage);
       }
       // Re-throw the error to be caught by the frontend caller
       throw error; // Throw the original error object
   }
});

