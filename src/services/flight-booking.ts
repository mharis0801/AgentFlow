/**
 * Represents the details of a flight.
 */
export interface Flight {
  /**
   * The flight number.
   */
  flightNumber: string;
  /**
   * The departure airport code.
   */
  departureAirport: string;
  /**
   * The arrival airport code.
   */
  arrivalAirport: string;
  /**
   * The departure time.
   */
  departureTime: string;
  /**
   * The arrival time.
   */
  arrivalTime: string;
}

/**
 * Represents search criteria for flight bookings.
 */
export interface FlightSearchCriteria {
  /**
   * The departure city.
   */
  departureCity: string;
  /**
   * The arrival city.
   */
  arrivalCity: string;
  /**
   * The departure date.
   */
  departureDate: string;
  /**
   * The number of passengers.
   */
  numberOfPassengers: number;
}

/**
 * Asynchronously finds flights based on the provided search criteria.
 *
 * @param searchCriteria The criteria to use for finding flights.
 * @returns A promise that resolves to an array of Flight objects.
 */
export async function findFlights(searchCriteria: FlightSearchCriteria): Promise<Flight[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      flightNumber: 'EX123',
      departureAirport: 'JFK',
      arrivalAirport: 'LAX',
      departureTime: '10:00',
      arrivalTime: '13:00',
    },
  ];
}
