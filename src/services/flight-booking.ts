
/**
 * @fileOverview Service for finding flights using the Amadeus API.
 * Requires environment variables: AMADEUS_API_KEY and AMADEUS_API_SECRET.
 */

import Amadeus from 'amadeus';
import { Flight, FlightSearchCriteria } from '@/services/flight-booking'; // Keep existing interfaces
import { getIataCode } from './location-service'; // Import IATA code helper

// Define the Flight interface (if not already defined elsewhere)
export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  priceUSD: number;
  bookingUrl?: string; // Amadeus sometimes provides deep links
}

// Define the FlightSearchCriteria interface (if not already defined elsewhere)
export interface FlightSearchCriteria {
  departureCity: string;
  arrivalCity: string;
  departureDate: string; // YYYY-MM-DD
  numberOfPassengers: number;
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
 * Searches for flights using the Amadeus API based on the provided criteria.
 *
 * @param searchCriteria The criteria to use for finding flights.
 * @returns A promise that resolves to an array of Flight objects.
 * @throws Will throw an error if API keys are missing or the API call fails.
 */
export async function searchFlightsAPI(searchCriteria: FlightSearchCriteria): Promise<Flight[]> {
    console.log("Searching flights via Amadeus API with criteria:", searchCriteria);
    const client = getAmadeusClient();

    try {
         // Get IATA codes for cities (implement this service)
         const originLocationCode = await getIataCode(searchCriteria.departureCity);
         const destinationLocationCode = await getIataCode(searchCriteria.arrivalCity);

         if (!originLocationCode || !destinationLocationCode) {
             throw new Error(`Could not find IATA codes for cities: ${searchCriteria.departureCity} or ${searchCriteria.arrivalCity}`);
         }

        const response = await client.shopping.flightOffersSearch.get({
            originLocationCode: originLocationCode,
            destinationLocationCode: destinationLocationCode,
            departureDate: searchCriteria.departureDate,
            adults: searchCriteria.numberOfPassengers.toString(), // API expects string
            max: 10, // Limit results for performance/cost
            currencyCode: 'USD'
        });

        // Check for non-array response or empty data
        if (!response || !response.data || !Array.isArray(response.data)) {
            console.warn("Amadeus API returned unexpected response format or no data:", response);
            return []; // Return empty array if no flights found or error in response structure
        }

        console.log(`Amadeus API returned ${response.data.length} flight offers.`);

        // Map the Amadeus response to our Flight interface
        const flights: Flight[] = response.data.map((offer: any): Flight | null => {
           try {
                const firstSegment = offer.itineraries?.[0]?.segments?.[0];
                const lastSegment = offer.itineraries?.[0]?.segments?.[offer.itineraries[0].segments.length - 1];
                const price = offer.price?.total ? parseFloat(offer.price.total) : 0;
                const airlineCode = firstSegment?.carrierCode;
                // Attempt to get airline name from dictionary, fallback to code
                const airlineName = response.dictionaries?.carriers?.[airlineCode] || airlineCode || 'Unknown Airline';
                const durationStr = offer.itineraries?.[0]?.duration; // e.g., PT5H30M

                let durationMinutes = 0;
                if (durationStr) {
                    const durationMatch = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
                    if (durationMatch) {
                        const hours = durationMatch[1] ? parseInt(durationMatch[1]) : 0;
                        const minutes = durationMatch[2] ? parseInt(durationMatch[2]) : 0;
                        durationMinutes = hours * 60 + minutes;
                    }
                }


                if (!firstSegment || !lastSegment || price === 0) {
                    console.warn("Skipping incomplete flight offer:", offer.id);
                    return null; // Skip incomplete offers
                }

                return {
                    id: offer.id, // Use Amadeus offer ID
                    airline: airlineName,
                    flightNumber: firstSegment.number || 'N/A', // Flight number might be per segment
                    departureAirport: firstSegment.departure?.iataCode || 'N/A',
                    arrivalAirport: lastSegment.arrival?.iataCode || 'N/A',
                    departureTime: firstSegment.departure?.at || 'N/A',
                    arrivalTime: lastSegment.arrival?.at || 'N/A',
                    durationMinutes: durationMinutes,
                    priceUSD: price,
                    // Check for deep links (structure might vary)
                    bookingUrl: offer.pricingOptions?.fareDetails?.[0]?.sliceDiceIndicator === 'SLICE_AND_DICE' ? `https://www.google.com/flights?q=${airlineCode}${firstSegment.number}%20${originLocationCode}%20${destinationLocationCode}%20${searchCriteria.departureDate}` : undefined
                };
           } catch (mapError: any) {
                console.error(`Error mapping flight offer ${offer.id}:`, mapError.message);
                return null; // Skip offers that cause mapping errors
           }
        }).filter((flight): flight is Flight => flight !== null); // Filter out null values

        console.log(`Successfully mapped ${flights.length} flight offers.`);
        return flights;

    } catch (error: any) {
        // Log detailed error from Amadeus if available
        console.error("Error searching flights with Amadeus:", error?.response?.data || error?.description || error.message);
         // Rethrow a more generic error or the specific one if needed
        throw new Error(`Failed to fetch flight data from provider. ${error?.description?.detail || error.message}`);
    }
}
