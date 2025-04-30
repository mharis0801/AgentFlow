'use server';
/**
 * @fileOverview This file defines a Genkit flow for booking hotel reservations based on structured user input.
 * Uses the simulated `findHotels` and `bookHotel` services.
 * Saves the booking details and result to Firestore.
 *
 * - bookHotelReservation - A function that takes structured hotel details and books a reservation.
 * - BookHotelReservationInput - The input type for the bookHotelReservation function.
 * - BookHotelReservationOutput - The return type for the bookHotelReservation function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import { findHotels, bookHotel, Hotel, HotelSearchCriteria} from '@/services/hotel-booking'; // Import simulated services
import { saveAgentTask, updateAgentTask } from '@/services/firestore'; // Import Firestore service

// Define the structured input schema for the form
const BookHotelReservationInputSchema = z.object({
  city: z.string().min(1, { message: 'City is required.' }).describe('The city where the hotel is located.'),
  checkInDate: z.string().date('Invalid check-in date format. Use YYYY-MM-DD.').describe('The check-in date (YYYY-MM-DD).'),
  checkOutDate: z.string().date('Invalid check-out date format. Use YYYY-MM-DD.').describe('The check-out date (YYYY-MM-DD).'),
  numberOfGuests: z.number().int().positive({ message: 'Number of guests must be positive.' }).describe('The number of guests (must be a positive integer).'),
  userId: z.string().describe("The UID of the user making the request."),
}).refine(data => new Date(data.checkInDate) < new Date(data.checkOutDate), {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"], // Optionally specify the field to associate the error with
});
export type BookHotelReservationInput = z.infer<typeof BookHotelReservationInputSchema>;

// Output schema includes more booking details and task ID
const BookHotelReservationOutputSchema = z.object({
  hotelName: z.string().describe('The name of the hotel that was booked.'),
  confirmationNumber: z.string().describe('The confirmation number for the hotel reservation.'),
  city: z.string().describe('The city of the booked hotel.'),
  checkInDate: z.string().date().describe('The confirmed check-in date (YYYY-MM-DD).'),
  checkOutDate: z.string().date().describe('The confirmed check-out date (YYYY-MM-DD).'),
  numberOfGuests: z.number().int().positive().describe('The number of guests booked.'),
  message: z.string().describe("A confirmation message about the booking."),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
  // Include optional details potentially added during the process
  address: z.string().optional().describe('The address of the booked hotel.'),
  rating: z.number().optional().describe('The rating of the booked hotel.'),
  pricePerNightUSD: z.number().optional().describe('The price per night of the booked hotel.'),
});
export type BookHotelReservationOutput = z.infer<typeof BookHotelReservationOutputSchema>;

// Entry function called by the frontend
export async function bookHotelReservation(input: BookHotelReservationInput): Promise<BookHotelReservationOutput> {
   if (!input.userId) {
       throw new Error("User ID must be provided to book a hotel.");
   }
   // Validate input using Zod before proceeding
   const validationResult = BookHotelReservationInputSchema.safeParse(input);
   if (!validationResult.success) {
       // Combine Zod errors into a single message
       const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')} - ${e.message}`).join(', ');
       throw new Error(`Invalid input: ${errorMessage}`);
   }
  return bookHotelReservationFlow(validationResult.data); // Pass validated data
}

// Define the flow using the structured input
const bookHotelReservationFlow = ai.defineFlow<
  typeof BookHotelReservationInputSchema,
  typeof BookHotelReservationOutputSchema
>({
  name: 'bookHotelReservationFlow',
  inputSchema: BookHotelReservationInputSchema,
  outputSchema: BookHotelReservationOutputSchema,
},
async (input) => {
   const { userId, ...searchCriteria } = input; // Directly use validated input as search criteria
   let taskId: string | undefined = undefined;
   let initialTaskSaved = false;

   // 1. Save initial pending task to Firestore
   try {
       taskId = await saveAgentTask({
           userId: userId,
           type: 'hotel',
           details: searchCriteria,
           status: 'pending', // Start as pending
       });
       initialTaskSaved = true;
       console.log(`Initial pending hotel task saved with ID: ${taskId}`);
   } catch (saveError: any) {
      // Log the detailed original error before re-throwing
       console.error("Failed to save initial pending task (Original Error):", saveError);
       // Re-throw with a more specific message, including the original one
       throw new Error(`Failed to initiate hotel booking task: ${saveError.message || 'Unknown Firestore save error'}`);
   }

   // Helper function to update task status on failure
   const updateTaskToFailed = async (errorMsg: string) => {
       if (taskId) {
           try {
               await updateAgentTask(taskId, { status: 'failed', error: errorMsg });
               console.log(`Hotel task ${taskId} updated to failed.`);
           } catch (updateError) {
               console.error(`Failed to update task ${taskId} to failed status:`, updateError);
           }
       }
   };

   try {
       // 2. Find available hotels using the simulated service.
       console.log("Searching for hotels with criteria:", searchCriteria);
       const availableHotels = await findHotels(searchCriteria);

       if (!availableHotels || availableHotels.length === 0) {
           const noHotelsMsg = `No hotels found matching your criteria in ${searchCriteria.city} for the specified dates.`;
           await updateTaskToFailed(noHotelsMsg);
           throw new Error(noHotelsMsg);
       }
       console.log(`Found ${availableHotels.length} potential hotels.`);

       // 3. Select a hotel and attempt booking (simulate booking the first result).
       //    In a real scenario, the AI might select based on rating, price, or user preferences.
       const hotelToBook = availableHotels[0];
       console.log(`Attempting to book hotel: ${hotelToBook.name}`);

       // Update task details with the chosen hotel before booking attempt
       if (taskId) {
           await updateAgentTask(taskId, {
               details: { ...searchCriteria, chosenHotel: hotelToBook },
               status: 'processing' // Indicate booking attempt
           });
       }

       // Call the simulated booking service
       const bookingResult = await bookHotel(hotelToBook, searchCriteria);

       // 4. Handle booking result
       if (!bookingResult.success || !bookingResult.confirmationNumber) {
           console.error(`Simulated booking failed for ${hotelToBook.name}: ${bookingResult.message}`);
           await updateTaskToFailed(bookingResult.message);
           throw new Error(bookingResult.message); // Throw error to frontend
       }

       // 5. Booking successful - Update task in Firestore to 'confirmed'.
       const bookingDetails = {
           hotelName: hotelToBook.name,
           confirmationNumber: bookingResult.confirmationNumber,
           city: searchCriteria.city,
           checkInDate: searchCriteria.checkInDate,
           checkOutDate: searchCriteria.checkOutDate,
           numberOfGuests: searchCriteria.numberOfGuests,
           address: hotelToBook.address, // Include more details if needed
           rating: hotelToBook.rating,
           pricePerNightUSD: hotelToBook.pricePerNightUSD,
       };
       if (taskId) {
           await updateAgentTask(taskId, {
               status: 'confirmed',
               details: bookingDetails, // Store final booking details
               result: { confirmationNumber: bookingResult.confirmationNumber, message: bookingResult.message },
               error: null, // Clear any previous error
           });
           console.log(`Hotel task ${taskId} updated to confirmed.`);
       }

       // 6. Return the successful result to the frontend.
       const finalResult: BookHotelReservationOutput = {
           ...bookingDetails,
           message: bookingResult.message,
           taskId: taskId,
       };
       return finalResult;

   } catch (error: any) {
       console.error("Error in bookHotelReservationFlow:", error);
       // Ensure the task is marked as failed if an error occurred after initial save
       if (initialTaskSaved && taskId) { // Only update if task was initially saved
           await updateTaskToFailed(error.message || 'An unexpected error occurred during hotel booking.');
       }
       // Re-throw the error to be caught by the frontend caller
       throw error; // Throw the original error object
   }
});