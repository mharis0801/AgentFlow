
/**
 * @fileOverview Mock service for finding hotels.
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
   /**
    * Optional URL to book the hotel (e.g., a deep link to a booking site).
    */
   bookingUrl?: string;
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
}

/**
 * Simulates searching for hotels based on the provided search criteria using an external API.
 *
 * @param searchCriteria The criteria to use for finding hotels.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function searchHotelsAPI(searchCriteria: HotelSearchCriteria): Promise<Hotel[]> {
  console.log("Simulating hotel search API call with criteria:", searchCriteria);

  // !! ================================================== !!
  // !! IMPORTANT: Real Implementation Required            !!
  // !! ================================================== !!
  // !! Replace this with actual API calls.
  // !! ================================================== !!

  // --- Start Simulation ---

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 700 + Math.random() * 600));

  const mockHotels: Hotel[] = [];
  const checkIn = new Date(searchCriteria.checkInDate);
  const checkOut = new Date(searchCriteria.checkOutDate);
  const numberOfNights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  if (searchCriteria.city) {
    const cityLower = searchCriteria.city.toLowerCase().replace(/\s+/g, '');
    const basePrice = 80 + Math.random() * 250;

    const hotelNames = [
        `The Grand ${searchCriteria.city} Plaza`,
        `Central ${searchCriteria.city} Boutique Hotel`,
        `Riverside Inn ${searchCriteria.city}`,
        `Cozy Nook B&B (${searchCriteria.city})`,
        `${searchCriteria.city} Skyline Towers`
    ];
    const descriptions = [
        "Luxury hotel in the heart of the city.",
        "Charming boutique hotel with unique rooms.",
        "Peaceful riverside location with great views.",
        "Affordable and friendly bed & breakfast.",
        "Modern hotel with stunning city views."
    ];

     for (let i = 0; i < Math.floor(3 + Math.random() * 6); i++) { // Generate 3-8 mock hotels
         const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1)); // 3.5 - 5.0 stars
         const price = parseFloat((basePrice + (Math.random() * 100 - 50)).toFixed(2));
         const hotelId = `mock-${cityLower}-${i + 1}${Date.now().toString().slice(-4)}`;

         // Simulate a booking URL (replace with actual deep links from API)
         const bookingUrl = `https://example-hotel-booking.com/hotels/${hotelId}?checkin=${searchCriteria.checkInDate}&checkout=${searchCriteria.checkOutDate}&guests=${searchCriteria.numberOfGuests}`;

         mockHotels.push({
           id: hotelId,
           name: hotelNames[i % hotelNames.length],
           address: `${200 + i * 150} ${cityLower.includes('river') ? 'River Rd' : 'Main St'}, ${searchCriteria.city}`,
           rating: rating,
           description: descriptions[i % descriptions.length],
           pricePerNightUSD: price,
           imageUrl: `https://picsum.photos/seed/${cityLower}${i+1}/300/200`, // Placeholder image
           bookingUrl: bookingUrl // Add the simulated booking URL
         });
     }
  }

  console.log(`Simulated finding ${mockHotels.length} hotels via API in ${searchCriteria.city}.`);
  return mockHotels;
  // --- End Simulation ---
}


// Note: The bookHotel function is removed as the flow now focuses on searching.
// Booking would typically happen by redirecting the user via the bookingUrl.

