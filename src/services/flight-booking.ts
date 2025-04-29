/**
 * @fileOverview Mock service for finding and booking flights.
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
  // Optional criteria (could be added later)
  // returnDate?: string;
  // maxPrice?: number;
  // preferredAirline?: string;
  // directOnly?: boolean;
}

/**
 * Simulates finding flights based on the provided search criteria.
 *
 * @param searchCriteria The criteria to use for finding flights.
 * @returns A promise that resolves to an array of Flight objects.
 */
export async function findFlights(searchCriteria: FlightSearchCriteria): Promise<Flight[]> {
  console.log("Simulating flight search with criteria:", searchCriteria);

  // !! ================================================== !!
  // !! IMPORTANT: Real Implementation Required            !!
  // !! ================================================== !!
  // !! This function should be replaced with actual API calls to a
  // !! flight search provider (GDS like Amadeus/Sabre, aggregator like Skyscanner).
  // !! Key considerations for a real implementation:
  // !! 1. API Integration: Choose an API, understand its request/response format.
  // !! 2. Authentication: Handle API keys or OAuth tokens securely.
  // !! 3. Parameter Mapping: Convert `searchCriteria` to the API's required parameters
  // !!    (e.g., airport codes, date formats, passenger types).
  // !! 4. Response Parsing: Parse the API response into the `Flight[]` structure.
  // !!    Handle different flight legs, connections, pricing details, taxes.
  // !! 5. Error Handling: Manage API errors, timeouts, no results scenarios.
  // !! 6. Cost & Usage: Be mindful of API call costs and rate limits.
  // !! 7. Caching: Consider caching results for short periods if appropriate.
  // !! ================================================== !!

  // --- Start Simulation ---

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));

  const mockResults: Flight[] = [];
  const departureBase = new Date(`${searchCriteria.departureDate}T00:00:00Z`);

  // Basic simulation: Generate a few mock flights if criteria match loosely
  // In a real scenario, this logic would be replaced by API calls.
  if (searchCriteria.departureCity && searchCriteria.arrivalCity) {
    const airlines = ["Airline Alpha", "Beta Airways", "Gamma Jet"];
    const basePrice = 150 + Math.random() * 300; // Base price range

    for (let i = 0; i < Math.floor(1 + Math.random() * 4); i++) { // Generate 1-4 mock flights
      const departureHour = Math.floor(8 + Math.random() * 10); // 8 AM - 5 PM
      const flightDuration = Math.floor(120 + Math.random() * 240); // 2-6 hours duration

      const departureTime = new Date(departureBase);
      departureTime.setUTCHours(departureHour, Math.floor(Math.random() * 60), 0, 0);

      const arrivalTime = new Date(departureTime);
      arrivalTime.setUTCMinutes(arrivalTime.getUTCMinutes() + flightDuration);

      const flightNum = `${airlines[i % airlines.length].substring(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
      const depAirport = searchCriteria.departureCity.length === 3 ? searchCriteria.departureCity.toUpperCase() : "AAA"; // Use code or mock
      const arrAirport = searchCriteria.arrivalCity.length === 3 ? searchCriteria.arrivalCity.toUpperCase() : "BBB"; // Use code or mock

      mockResults.push({
        id: `${flightNum}-${departureTime.toISOString()}`,
        airline: airlines[i % airlines.length],
        flightNumber: flightNum,
        departureAirport: depAirport,
        arrivalAirport: arrAirport,
        departureTime: departureTime.toISOString(),
        arrivalTime: arrivalTime.toISOString(),
        durationMinutes: flightDuration,
        priceUSD: parseFloat((basePrice + (Math.random() * 100 - 50)).toFixed(2)), // Add price variation
      });
    }
  }

   // Sort by departure time for consistency
   mockResults.sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  console.log(`Simulated finding ${mockResults.length} flights.`);
  return mockResults;
  // --- End Simulation ---
}

/**
 * Simulates booking a specific flight.
 * In a real application, this would involve a separate API call to confirm the booking,
 * handle payment, and receive a confirmation number/PNR.
 *
 * @param flight The flight object to book.
 * @param numberOfPassengers The number of passengers for the booking.
 * @returns A promise resolving to a simulated booking confirmation object.
 */
export async function bookFlight(flight: Flight, numberOfPassengers: number): Promise<{ success: boolean; confirmationNumber: string | null; message: string }> {
    console.log(`Simulating booking flight ${flight.flightNumber} for ${numberOfPassengers} passengers...`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));

    // Simulate potential booking failure (e.g., 15% chance)
    const shouldFail = Math.random() < 0.15;
    if (shouldFail) {
        console.error(`Simulated booking failure for flight ${flight.flightNumber}.`);
        return {
            success: false,
            confirmationNumber: null,
            message: `Booking failed for flight ${flight.flightNumber}. The fare may have changed or the seats are no longer available. Please try searching again.`
        };
    }

    // Simulate successful booking
    const confirmationNumber = `FL-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    console.log(`Simulated booking successful for flight ${flight.flightNumber}. Confirmation: ${confirmationNumber}`);

    return {
        success: true,
        confirmationNumber: confirmationNumber,
        message: `Flight ${flight.flightNumber} from ${flight.departureAirport} to ${flight.arrivalAirport} for ${numberOfPassengers} passenger(s) is confirmed (simulated). Confirmation number: ${confirmationNumber}.`
    };
}
