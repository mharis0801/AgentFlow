
/**
 * @fileOverview Service for finding hotels using the Amadeus API.
 * Requires environment variables: AMADEUS_API_KEY and AMADEUS_API_SECRET.
 */

import Amadeus from 'amadeus';
import { Hotel, HotelSearchCriteria } from '@/services/hotel-booking'; // Keep existing interfaces
import { getIataCode } from './location-service'; // Import IATA code helper

// Define the Hotel interface (if not already defined elsewhere)
export interface Hotel {
  id: string;
  name: string;
  address: string; // Full address might not always be available, construct if possible
  rating: number; // May need conversion or might be absent
  description?: string; // Less common in basic availability search
  pricePerNightUSD: number; // Extracted from the offer
  imageUrl?: string; // Amadeus doesn't typically provide images directly in search
  bookingUrl?: string; // May need to construct a link
}

// Define the HotelSearchCriteria interface (if not already defined elsewhere)
export interface HotelSearchCriteria {
  city: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  numberOfGuests: number;
}

let amadeus: Amadeus | null = null;

function getAmadeusClient(): Amadeus {
    if (!amadeus) {
        const apiKey = process.env.AMADEUS_API_KEY;
        const apiSecret = process.env.AMADEUS_API_SECRET;

        if (!apiKey || !apiSecret) {
            throw new Error("Amadeus API Key or Secret not found in environment variables.");
        }

        amadeus = new Amadeus({
            clientId: apiKey,
            clientSecret: apiSecret,
            // Use hostname: 'test.api.amadeus.com' for testing environment
            hostname: 'production' === process.env.NODE_ENV ? 'api.amadeus.com' : 'test.api.amadeus.com'
        });
         console.log(`Amadeus client initialized for ${amadeus.hostname}`);
    }
    return amadeus;
}


/**
 * Searches for hotels using the Amadeus API based on the provided criteria.
 * Note: This uses the 'Hotel List' endpoint first to get hotel IDs, then 'Hotel Offers' for pricing.
 * This is a common pattern but might incur multiple API calls.
 *
 * @param searchCriteria The criteria to use for finding hotels.
 * @returns A promise that resolves to an array of Hotel objects with pricing.
 * @throws Will throw an error if API keys are missing or the API call fails.
 */
export async function searchHotelsAPI(searchCriteria: HotelSearchCriteria): Promise<Hotel[]> {
    console.log("Searching hotels via Amadeus API with criteria:", searchCriteria);
    const client = getAmadeusClient();

    try {
        // 1. Get IATA code for the city
        const cityCode = await getIataCode(searchCriteria.city);
        if (!cityCode) {
            throw new Error(`Could not find IATA code for city: ${searchCriteria.city}`);
        }

        // 2. Search for hotels in the city to get Hotel IDs
        const hotelListResponse = await client.referenceData.locations.hotels.byCity.get({
            cityCode: cityCode,
            ratings: '4,5', // Example: Filter for 4 and 5-star hotels, adjust as needed
            radius: 20, // Search radius in KM
            radiusUnit: 'KM'
        });

        if (!hotelListResponse || !hotelListResponse.data || !Array.isArray(hotelListResponse.data) || hotelListResponse.data.length === 0) {
            console.warn("Amadeus Hotel List returned no hotels for the city code:", cityCode);
            return []; // No hotels found for the criteria
        }

        const hotelIds = hotelListResponse.data.map((hotel: any) => hotel.hotelId).slice(0, 10); // Limit IDs to avoid excessive offer calls
        console.log(`Found ${hotelIds.length} potential hotel IDs in ${searchCriteria.city}. Fetching offers...`);

        if (hotelIds.length === 0) {
            return [];
        }

        // 3. Get offers (pricing) for the found hotel IDs
        const hotelOffersResponse = await client.shopping.hotelOffersSearch.get({
            hotelIds: hotelIds.join(','), // Join IDs into a comma-separated string
            adults: searchCriteria.numberOfGuests.toString(),
            checkInDate: searchCriteria.checkInDate,
            checkOutDate: searchCriteria.checkOutDate,
            currency: 'USD',
            // Optional: paymentPolicy, boardType etc.
        });


         if (!hotelOffersResponse || !hotelOffersResponse.data || !Array.isArray(hotelOffersResponse.data)) {
             console.warn("Amadeus Hotel Offers Search returned unexpected response format or no data:", hotelOffersResponse);
             return [];
         }

         console.log(`Amadeus API returned ${hotelOffersResponse.data.length} hotel offers.`);

        // 4. Map offers to our Hotel interface
        const hotels: Hotel[] = hotelOffersResponse.data
            .map((offer: any): Hotel | null => {
               try {
                    if (!offer.hotel || !offer.offers?.[0]?.price?.total) {
                        console.warn("Skipping incomplete hotel offer:", offer.hotel?.hotelId);
                        return null; // Skip if essential data is missing
                    }

                    const priceTotal = parseFloat(offer.offers[0].price.total);
                    const checkInDate = new Date(searchCriteria.checkInDate);
                    const checkOutDate = new Date(searchCriteria.checkOutDate);
                    const nights = Math.max(1, (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
                    const pricePerNight = priceTotal / nights;

                    // Construct address (might be incomplete)
                    const ad = offer.hotel.address;
                    const addressString = [ad?.lines?.[0], ad?.cityName, ad?.postalCode, ad?.countryCode]
                                         .filter(Boolean).join(', ');

                   // Construct a basic booking link (adjust as needed for real deeplinks if available)
                    const bookingUrl = `https://www.google.com/travel/hotels/${encodeURIComponent(searchCriteria.city)}/entity/${offer.hotel.hotelId}?q=${encodeURIComponent(offer.hotel.name || searchCriteria.city)}&checkin=${searchCriteria.checkInDate}&checkout=${searchCriteria.checkOutDate}&guests=${searchCriteria.numberOfGuests}`;


                    return {
                        id: offer.hotel.hotelId,
                        name: offer.hotel.name || 'Unknown Hotel Name',
                        address: addressString || 'Address not available',
                        rating: offer.hotel.rating ? parseInt(offer.hotel.rating) : 0, // Rating might be string
                        description: offer.offers?.[0]?.room?.description?.text?.substring(0, 100) + '...' || undefined, // Use room description if available
                        pricePerNightUSD: parseFloat(pricePerNight.toFixed(2)),
                        imageUrl: `https://picsum.photos/seed/${offer.hotel.hotelId}/300/200`, // Placeholder image
                        bookingUrl: bookingUrl,
                    };
               } catch(mapError: any) {
                    console.error(`Error mapping hotel offer ${offer.hotel?.hotelId}:`, mapError.message);
                    return null; // Skip offers causing mapping errors
               }
            })
             .filter((hotel): hotel is Hotel => hotel !== null); // Filter out nulls

        console.log(`Successfully mapped ${hotels.length} hotel offers with pricing.`);
        return hotels;

    } catch (error: any) {
        console.error("Error searching hotels with Amadeus:", error?.response?.data || error?.description || error.message);
        throw new Error(`Failed to fetch hotel data from provider. ${error?.description?.detail || error.message}`);
    }
}
