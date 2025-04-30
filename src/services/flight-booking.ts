
/**
 * @fileOverview Mock service for finding flights.
 * **NOTE:** This uses mock data. A real implementation requires integrating
 * with a flight booking API (e.g., Amadeus, Sabre, Skyscanner API) or a
 * third-party aggregator service. These often require commercial agreements.
 */

/**
 * Represents the details of a flight.
 */
export interface Flight {
  /**
   * A unique identifier for the flight option (can be composite).
   */
  id: string;
  /**
   * The airline operating the flight (e.g., "United Airlines").
   */
  airline: string;
  /**
   * The flight number (e.g., "UA456").
   */
  flightNumber: string;
  /**
   * The departure airport code (IATA).
   */
  departureAirport: string;
  /**
   * The arrival airport code (IATA).
   */
  arrivalAirport: string;
  /**
   * The departure date and time in ISO 8601 format (UTC).
   */
  departureTime: string;
  /**
   * The arrival date and time in ISO 8601 format (UTC).
   */
  arrivalTime: string;
  /**
   * Duration of the flight in minutes.
   */
  durationMinutes: number;
  /**
   * Price per passenger in USD (for simulation).
   */
  priceUSD: number;
  /**
   * Optional URL to book the flight (e.g., a deep link to the airline's site).
   */
  bookingUrl?: string;
}

/**
 * Represents search criteria for flight bookings.
 */
export interface FlightSearchCriteria {
  /**
   * The departure city or airport code (IATA).
   */
  departureCity: string; // e.g., "New York", "JFK"
  /**
   * The arrival city or airport code (IATA).
   */
  arrivalCity: string; // e.g., "Los Angeles", "LAX"
  /**
   * The departure date (YYYY-MM-DD format).
   */
  departureDate: string;
  /**
   * The number of passengers.
   */
  numberOfPassengers: number;
}

/**
 * Simulates searching for flights based on the provided search criteria using an external API.
 *
 * @param searchCriteria The criteria to use for finding flights.
 * @returns A promise that resolves to an array of Flight objects.
 */
export async function searchFlightsAPI(searchCriteria: FlightSearchCriteria): Promise<Flight[]> {
  console.log("Simulating flight search API call with criteria:", searchCriteria);

  // !! ================================================== !!
  // !! IMPORTANT: Real Implementation Required            !!
  // !! ================================================== !!
  // !! Replace this with actual API calls.
  // !! ================================================== !!

  // --- Start Simulation ---

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));

  const mockResults: Flight[] = [];
  const departureBase = new Date(`${searchCriteria.departureDate}T00:00:00Z`);

  if (searchCriteria.departureCity && searchCriteria.arrivalCity) {
    const airlines = ["Skylink Airways", "Horizon Jet", "Apex Airlines"];
    const basePrice = 150 + Math.random() * 300;

    for (let i = 0; i < Math.floor(2 + Math.random() * 5); i++) { // Generate 2-6 mock flights
      const departureHour = Math.floor(7 + Math.random() * 12); // 7 AM - 6 PM
      const flightDuration = Math.floor(90 + Math.random() * 300); // 1.5 - 5 hours duration

      const departureTime = new Date(departureBase);
      departureTime.setUTCHours(departureHour, Math.floor(Math.random() * 60), 0, 0);

      const arrivalTime = new Date(departureTime);
      arrivalTime.setUTCMinutes(arrivalTime.getUTCMinutes() + flightDuration);

      const airlineName = airlines[i % airlines.length];
      const flightNum = `${airlineName.substring(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
      const depAirport = searchCriteria.departureCity.length === 3 ? searchCriteria.departureCity.toUpperCase() : "DEP";
      const arrAirport = searchCriteria.arrivalCity.length === 3 ? searchCriteria.arrivalCity.toUpperCase() : "ARR";

      // Simulate a booking URL (replace with actual deep links from API)
      const bookingUrl = `https://example-airline-booking.com/book?flight=${flightNum}&dep=${depAirport}&arr=${arrAirport}&date=${searchCriteria.departureDate}&pax=${searchCriteria.numberOfPassengers}`;

      mockResults.push({
        id: `${flightNum}-${departureTime.toISOString()}`,
        airline: airlineName,
        flightNumber: flightNum,
        departureAirport: depAirport,
        arrivalAirport: arrAirport,
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        durationMinutes: flightDuration,
        priceUSD: parseFloat((basePrice + (Math.random() * 100 - 50)).toFixed(2)),
        bookingUrl: bookingUrl // Add the simulated booking URL
      });
    }
  }

   mockResults.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  console.log(`Simulated finding ${mockResults.length} flights via API.`);
  return mockResults;
  // --- End Simulation ---
}

// Note: The bookFlight function is removed as the flow now focuses on searching.
// Booking would typically happen by redirecting the user via the bookingUrl.

