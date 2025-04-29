'use server';
/**
 * @fileOverview This file defines a Genkit flow for booking hotel reservations based on structured user input.
 * Saves the booking details and result to Firestore.
 *
 * - bookHotelReservation - A function that takes structured hotel details and books a reservation.
 * - BookHotelReservationInput - The input type for the bookHotelReservation function.
 * - BookHotelReservationOutput - The return type for the bookHotelReservation function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {findHotels, Hotel, HotelSearchCriteria} from '@/services/hotel-booking';
import { saveAgentTask } from '@/services/firestore'; // Import Firestore service

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

// Output schema remains the same
const BookHotelReservationOutputSchema = z.object({
  hotelName: z.string().describe('The name of the hotel that was booked.'),
  confirmationNumber: z.string().describe('The confirmation number for the hotel reservation.'),
  checkInDate: z.string().date().optional().describe('The confirmed check-in date (YYYY-MM-DD).'),
  checkOutDate: z.string().date().optional().describe('The confirmed check-out date (YYYY-MM-DD).'),
  taskId: z.string().optional().describe("The ID of the saved task in Firestore."),
});
export type BookHotelReservationOutput = z.infer<typeof BookHotelReservationOutputSchema>;

// Renamed function to reflect structured input
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
  name: 'bookHotelReservationFlow', // Renamed flow
  inputSchema: BookHotelReservationInputSchema,
  outputSchema: BookHotelReservationOutputSchema,
},
async (input) => {
   const { userId, ...searchCriteria } = input; // Directly use input as search criteria
   let taskId: string | undefined = undefined;
   let finalResult: BookHotelReservationOutput;

  try {
      // Input is already validated by the calling function
      console.log("Validated Search Criteria:", searchCriteria);

      // 1. Find available hotels (using the mock service for now).
      const availableHotels = await findHotels(searchCriteria);
      if (!availableHotels || availableHotels.length === 0) {
        throw new Error(`No hotels found matching your criteria in ${searchCriteria.city} for the specified dates.`);
      }

      // 2. Select a hotel and simulate booking.
      // For simplicity, we book the first available hotel.
      const hotelToBook = availableHotels[0];
      console.log(`Simulating booking for: ${hotelToBook.name}`);
      const confirmationNumber = `CONF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      // 3. Save successful task to Firestore.
      const bookingDetails = {
          hotelName: hotelToBook.name,
          confirmationNumber: confirmationNumber,
          city: searchCriteria.city,
          checkInDate: searchCriteria.checkInDate,
          checkOutDate: searchCriteria.checkOutDate,
          numberOfGuests: searchCriteria.numberOfGuests,
          // Add hotel address/rating if needed:
          // address: hotelToBook.address,
          // rating: hotelToBook.rating,
      };
      taskId = await saveAgentTask({
          userId: userId,
          type: 'hotel',
          // prompt: prompt, // Remove prompt as it's no longer used
          details: bookingDetails, // Save the search criteria and booking info
          status: 'confirmed',
          result: { confirmationNumber: confirmationNumber },
      });

      // 4. Return the successful result.
       finalResult = {
           hotelName: hotelToBook.name,
           confirmationNumber: confirmationNumber,
           checkInDate: searchCriteria.checkInDate,
           checkOutDate: searchCriteria.checkOutDate,
           taskId: taskId,
       };
       return finalResult;

    } catch (error: any) {
       console.error("Error in bookHotelReservationFlow:", error);
       let errorMessage = 'An unexpected error occurred during hotel booking.';
       let status: 'failed' = 'failed';

       if (error.message) {
           errorMessage = error.message;
           // Check if it's a "No hotels found" error to potentially set a different status or detail
           if (errorMessage.startsWith('No hotels found')) {
               // status = 'no_results'; // Or keep as 'failed'
           }
       }

        // Attempt to save failed task
       try {
           taskId = await saveAgentTask({
               userId: userId,
               type: 'hotel',
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
});
