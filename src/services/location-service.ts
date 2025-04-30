
'use server';
/**
 * @fileOverview Service for finding IATA location codes (airports, cities) using Amadeus.
 * Requires environment variables: AMADEUS_API_KEY and AMADEUS_API_SECRET.
 */

import Amadeus from 'amadeus';

let amadeus: Amadeus | null = null;
const cache = new Map<string, string>(); // Simple in-memory cache for IATA codes

function getAmadeusClient(): Amadeus {
    if (!amadeus) {
        const apiKey = process.env.AMADEUS_API_KEY;
        const apiSecret = process.env.AMADEUS_API_SECRET;

        if (!apiKey || !apiSecret) {
            throw new Error("Amadeus API Key or Secret not found in environment variables for location service.");
        }

        amadeus = new Amadeus({
            clientId: apiKey,
            clientSecret: apiSecret,
            hostname: 'production' === process.env.NODE_ENV ? 'api.amadeus.com' : 'test.api.amadeus.com'
        });
        console.log(`Amadeus client initialized for Location Service on ${amadeus.hostname}`);
    }
    return amadeus;
}

/**
 * Gets the IATA code for a given city or airport name.
 * Prioritizes city codes if available, otherwise falls back to the first airport code.
 * Caches results in memory.
 *
 * @param locationName The name of the city or airport (e.g., "London", "New York", "Heathrow", "JFK").
 * @returns A promise that resolves to the IATA code (string) or null if not found.
 */
export async function getIataCode(locationName: string): Promise<string | null> {
    const cacheKey = locationName.toLowerCase().trim();
    if (cache.has(cacheKey)) {
        console.log(`Cache hit for IATA code: ${locationName} -> ${cache.get(cacheKey)}`);
        return cache.get(cacheKey) ?? null;
    }

    // Handle direct IATA input
    if (locationName.length === 3 && /^[A-Z]+$/.test(locationName)) {
         console.log(`Input '${locationName}' looks like an IATA code, returning directly.`);
         cache.set(cacheKey, locationName);
         return locationName;
     }


    console.log(`Fetching IATA code for: ${locationName}`);
    const client = getAmadeusClient();

    try {
        const response = await client.referenceData.locations.get({
            keyword: locationName,
            subType: Amadeus.location.any, // Search for both cities and airports
        });

        if (!response || !response.data || response.data.length === 0) {
            console.warn(`No IATA code found for location: ${locationName}`);
            return null;
        }

        // Prioritize city code, then airport code
        const city = response.data.find((loc: any) => loc.subType === 'CITY');
        const airport = response.data.find((loc: any) => loc.subType === 'AIRPORT');

        let iataCode: string | null = null;

        if (city && city.iataCode) {
            iataCode = city.iataCode;
            console.log(`Found CITY IATA code for ${locationName}: ${iataCode}`);
        } else if (airport && airport.iataCode) {
            iataCode = airport.iataCode;
            console.log(`Found AIRPORT IATA code for ${locationName}: ${iataCode}`);
        } else {
             // Fallback if no specific city/airport code found but results exist
             if(response.data[0].iataCode) {
                 iataCode = response.data[0].iataCode;
                 console.log(`Found generic IATA code for ${locationName}: ${iataCode} (Type: ${response.data[0].subType})`);
             } else {
                console.warn(`No valid IATA code in results for ${locationName}. Results:`, response.data);
                return null;
             }
        }

        if (iataCode) {
            cache.set(cacheKey, iataCode);
        }

        return iataCode;

    } catch (error: any) {
        console.error(`Error fetching IATA code for ${locationName}:`, error?.response?.data || error?.description || error.message);
        // Don't throw, just return null to indicate failure
        return null;
    }
}
