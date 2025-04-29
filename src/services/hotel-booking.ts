/**
 * @fileOverview Mock service for finding and booking hotels.
 * **NOTE:** This uses mock data. A real implementation requires integrating
 * with a hotel booking API (e.g., Expedia Rapid API, Booking.com API, Amadeus)
 * or a GDS (Global Distribution System). These usually require partnerships
 * and commercial agreements.
 */

/**
 * Represents the details of a hotel.
 */
export interface Hotel {
  /**
   * A unique identifier for the hotel.
   */
  id: string;
  /**
   * The name of the hotel.
   */
  name: string;
  /**
   * The address of the hotel.
   */
  address: string;
  /**
   * The star rating of the hotel (e.g., 1 to 5).
   */
  rating: number; // e.g., 4.5
   /**
    * A short description or key amenity.
    */
   description: string;
   /**
    * Simulated price per night in USD.
    */
   pricePerNightUSD: number;
   /**
    * URL to a placeholder image for the hotel.
    */
   imageUrl: string;
}

/**
 * Represents search criteria for hotel bookings.
 */
export interface HotelSearchCriteria {
  /**
   * The city, region, or specific location.
   */
  city: string;
  /**
   * The check-in date (YYYY-MM-DD format).
   */
  checkInDate: string;
  /**
   * The check-out date (YYYY-MM-DD format).
   */
  checkOutDate: string;
  /**
   * The number of guests.
   */
  numberOfGuests: number;
   // Optional criteria (could be added later)
   // numberOfRooms?: number;
   // maxPricePerNight?: number;
   // minRating?: number;
   // amenities?: string[]; // e.g., ["pool", "gym", "wifi"]
}

/**
 * Simulates finding hotels based on the provided search criteria.
 *
 * @param searchCriteria The criteria to use for finding hotels.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function findHotels(searchCriteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Simulating hotel search with criteria:", searchCriteria);

  // !! ================================================== !!
  // !! IMPORTANT: Real Implementation Required            !!
  // !! ================================================== !!
  // !! This function should be replaced with actual API calls to a
  // !! hotel booking provider (e.g., Expedia, Booking.com, Hotelbeds, GDS).
  // !! Key considerations for a real implementation:
  // !! 1. API Integration: Select an API, register, get credentials.
  // !! 2. Authentication: Handle API keys or OAuth tokens securely.
  // !! 3. Parameter Mapping: Convert `searchCriteria` into the API's format
  // !!    (location IDs, date formats, guest/room configurations).
  // !! 4. Response Parsing: Map the API response (hotels, rates, availability)
  // !!    to the `Hotel[]` structure. Handle complex rate rules, taxes, fees.
  // !! 5. Availability Checks: Ensure the API confirms real-time availability.
  // !! 6. Error Handling: Manage API errors, timeouts, invalid criteria, no results.
  // !! 7. Caching: Consider caching results for short durations if applicable.
  // !! ================================================== !!

  // --- Start Simulation ---

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 600));

  const mockHotels: Hotel[] = [];
  const checkIn = new Date(searchCriteria.checkInDate);
  const checkOut = new Date(searchCriteria.checkOutDate);
  const numberOfNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  // Generate some mock hotels based loosely on the city name
  if (searchCriteria.city) {
    const cityLower = searchCriteria.city.toLowerCase();
    const basePrice = 80 + Math.random() * 250; // Base price range per night

    const hotelNames = [
        `Grand ${searchCriteria.city} Hotel`,
        `${searchCriteria.city} Central Inn`,
        `Riverside ${searchCriteria.city} Suites`,
        `The Cozy Corner (${searchCriteria.city})`,
        `Downtown ${searchCriteria.city} Lodge`
    ];
    const descriptions = [
        "City center location, free WiFi",
        "Close to attractions, continental breakfast",
        "Spacious suites, river views",
        "Budget-friendly, clean rooms",
        "Business amenities, rooftop bar"
    ];

     for (let i = 0; i < Math.floor(2 + Math.random() * 4); i++) { // Generate 2-5 mock hotels
         const rating = parseFloat((3 + Math.random() * 2).toFixed(1)); // 3.0 - 5.0 stars
         const price = parseFloat((basePrice + (Math.random() * 80 - 40)).toFixed(2)); // Price variation

         mockHotels.push({
           id: `mock-${cityLower}-${i + 1}${Date.now().toString().slice(-4)}`,
           name: hotelNames[i % hotelNames.length],
           address: `${100 + i * 123} Main St, ${searchCriteria.city}`,
           rating: rating,
           description: descriptions[i % descriptions.length],
           pricePerNightUSD: price,
           imageUrl: `https://picsum.photos/seed/${cityLower}${i}/300/200`, // Placeholder image
         });
     }
  }

  console.log(`Simulated finding ${mockHotels.length} hotels in ${searchCriteria.city}.`);
  return mockHotels;
  // --- End Simulation ---
}


/**
 * Simulates booking a specific hotel room.
 * In a real application, this would involve selecting a specific room type and rate,
 * then making a booking request, possibly handling payment.
 *
 * @param hotel The hotel object containing details.
 * @param searchCriteria The original search criteria (needed for dates/guests).
 * @returns A promise resolving to a simulated booking confirmation object.
 */
export async function bookHotel(hotel: Hotel, searchCriteria: HotelSearchCriteria): Promise<{ success: boolean; confirmationNumber: string | null; message: string }> {
    console.log(`Simulating booking hotel "${hotel.name}" for ${searchCriteria.numberOfGuests} guests from ${searchCriteria.checkInDate} to ${searchCriteria.checkOutDate}...`);

     // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

     // Simulate potential booking failure (e.g., 10% chance)
     const shouldFail = Math.random() < 0.10;
     if (shouldFail) {
         console.error(`Simulated booking failure for hotel "${hotel.name}".`);
         return {
             success: false,
             confirmationNumber: null,
             message: `Booking failed for "${hotel.name}". The room may no longer be available at this rate. Please try searching again.`
         };
     }

     // Simulate successful booking
     const confirmationNumber = `HOTEL-${Date.now().toString().slice(-5)}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
     console.log(`Simulated booking successful for "${hotel.name}". Confirmation: ${confirmationNumber}`);

     return {
         success: true,
         confirmationNumber: confirmationNumber,
         message: `Reservation at "${hotel.name}" for ${searchCriteria.numberOfGuests} guest(s) from ${searchCriteria.checkInDate} to ${searchCriteria.checkOutDate} is confirmed (simulated). Confirmation number: ${confirmationNumber}.`
     };
}
