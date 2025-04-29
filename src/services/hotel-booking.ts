/**
 * Represents the details of a hotel.
 */
export interface Hotel {
  /**
   * The name of the hotel.
   */
  name: string;
  /**
   * The address of the hotel.
   */
  address: string;
  /**
   * The rating of the hotel (e.g., 4 stars).
   */
  rating: number;
}

/**
 * Represents search criteria for hotel bookings.
 */
export interface HotelSearchCriteria {
  /**
   * The city where the hotel is located.
   */
  city: string;
  /**
   * The check-in date.
   */
  checkInDate: string;
  /**
   * The check-out date.
   */
  checkOutDate: string;
  /**
   * The number of guests.
   */
  numberOfGuests: number;
}

/**
 * Asynchronously finds hotels based on the provided search criteria.
 *
 * @param searchCriteria The criteria to use for finding hotels.
 * @returns A promise that resolves to an array of Hotel objects.
 */
export async function findHotels(searchCriteria: HotelSearchCriteria): Promise<Hotel[]> {
  // TODO: Implement this by calling an API.

  return [
    {
      name: 'Example Hotel',
      address: '123 Main St',
      rating: 4,
    },
  ];
}
