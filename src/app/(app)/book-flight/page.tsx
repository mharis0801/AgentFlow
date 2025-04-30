
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, PlaneTakeoff, CheckCircle, Building, Clock, Ticket, Users, DollarSign, AlertCircle, ExternalLink, Search } from "lucide-react"; // Added Search icon
import Link from "next/link"; // For external booking links

import { searchFlights, SearchFlightsOutput } from "@/ai/flows/search-flights"; // Import the search flow
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
// Ensure Flight type is imported if needed for explicit typing, though SearchFlightsOutput might suffice
// import { Flight } from "@/services/flight-booking";

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  departureCity: z.string().min(1, { message: "Departure city/airport is required." }),
  arrivalCity: z.string().min(1, { message: "Arrival city/airport is required." }),
  departureDate: z.date({ required_error: "Departure date is required." }),
  numberOfPassengers: z.coerce.number().int().positive({ message: "Number of passengers must be a positive number." }),
});

// Type for the flight search results array (using the flow's output type)
type FlightSearchResults = SearchFlightsOutput;

export default function SearchFlightPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<FlightSearchResults>([]); // Store array of flights
  const [error, setError] = React.useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = React.useState(false); // Track if search was done

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      departureCity: "",
      arrivalCity: "",
      departureDate: undefined,
      numberOfPassengers: 1,
    },
  });

   async function onSubmit(data: z.infer<typeof FormSchema>) {
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be signed in to search for flights.",
          variant: "destructive",
        });
        return;
      }

    setIsLoading(true);
    setResults([]); // Clear previous results
    setError(null); // Clear previous errors
    setSearchPerformed(true); // Mark that a search has been attempted
    try {
        // Format date to YYYY-MM-DD string before sending
        const inputData = {
            ...data,
            departureDate: format(data.departureDate, 'yyyy-MM-dd'),
            userId: user.uid,
        };

       // Call the search flow function
      const response = await searchFlights(inputData);
      setResults(response); // Set the array of flight results
       if (response.length > 0) {
            toast({
                title: "Flight Search Successful",
                description: `Found ${response.length} flight options.`,
            });
       } else {
            toast({
                title: "No Flights Found",
                description: "Your search returned no results. Try different criteria.",
                variant: "default", // Use default variant for no results
            });
       }
    } catch (error: any) {
      console.error("Detailed error searching flights:", error); // Log the full error object
      let errorMessage = "An unexpected error occurred while searching for flights.";
      if (error instanceof Error) {
         errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
         errorMessage = error;
      } else if (error?.details) {
          errorMessage = error.details;
      } else if (error?.response?.data?.errors?.[0]?.detail) {
          // Attempt to get Amadeus specific error detail
          errorMessage = error.response.data.errors[0].detail;
      }
      setError(errorMessage); // Set error state
      setResults([]); // Ensure results are empty on error
      toast({
        title: "Flight Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Format ISO string to readable date and time
   const formatDisplayDateTime = (dateTimeString: string | undefined): string => {
       if (!dateTimeString) return 'N/A';
       try {
           const date = new Date(dateTimeString);
           if (isNaN(date.getTime())) return dateTimeString; // Fallback
           return format(date, "PPp"); // e.g., Sep 15, 2024, 10:30 AM
       } catch {
           return dateTimeString; // Fallback
       }
   };

   // Format duration in minutes to hours and minutes string
   const formatDuration = (minutes: number | undefined): string => {
     if (minutes === undefined || minutes <= 0) return 'N/A'; // Check for 0 or negative
     const hours = Math.floor(minutes / 60);
     const mins = minutes % 60;
     return `${hours > 0 ? `${hours}h ` : ''}${mins}m`; // Show hours only if > 0
   };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Search Flights</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>Flight Finder</CardTitle>
          <CardDescription>
            Enter your flight details below to search real-time availability.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Departure City */}
              <FormField
                control={form.control}
                name="departureCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Departure City / Airport</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., New York, JFK" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription>City name or IATA code.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Arrival City */}
              <FormField
                control={form.control}
                name="arrivalCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Arrival City / Airport</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Los Angeles, LAX" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription>City name or IATA code.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Departure Date */}
              <FormField
                control={form.control}
                name="departureDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Departure Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isLoading}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? (
                              format(field.value, "PPP") // Display format
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setHours(0, 0, 0, 0)) // Disable past dates
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Number of Passengers */}
              <FormField
                control={form.control}
                name="numberOfPassengers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passengers (Adults)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g., 1" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription>Number of adult travelers.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end pt-6">
              <Button type="submit" disabled={isLoading || !user} className="bg-primary hover:bg-primary/90">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching Flights...
                  </>
                ) : (
                   <>
                     <Search className="mr-2 h-4 w-4"/> Search Flights
                   </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {/* Loading State */}
      {isLoading && (
          <div className="text-center py-12">
             <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
             <p className="mt-2 text-muted-foreground">Searching for flights...</p>
          </div>
      )}

      {/* Error State */}
      {searchPerformed && !isLoading && error && (
          <Card className="max-w-2xl mx-auto mt-8 shadow-md border-destructive/50 bg-destructive/10">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" /> Search Error
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-destructive">{error}</p>
                  <p className="text-xs text-destructive/80 mt-2">Please check your input or try again later. API services might be temporarily unavailable.</p>
              </CardContent>
          </Card>
      )}

      {/* No Results State */}
      {searchPerformed && !isLoading && !error && results.length === 0 && (
         <Card className="max-w-2xl mx-auto mt-8 shadow-md border-primary/20 bg-muted/30">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-muted-foreground">
                      <PlaneTakeoff className="h-5 w-5" /> No Flights Found
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground">No flights matched your search criteria. Please try different dates or cities.</p>
              </CardContent>
          </Card>
      )}

       {/* Results Display */}
       {results.length > 0 && !error && !isLoading && (
         <div className="max-w-4xl mx-auto mt-8">
            <h2 className="text-2xl font-semibold mb-4 text-center text-foreground">Search Results</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {results.map((flight) => (
                     <Card key={flight.id} className="shadow-md border-primary/20 hover:shadow-lg transition-shadow duration-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="flex justify-between items-center">
                                <span className="text-lg text-primary">
                                    {flight.departureAirport || 'N/A'} <PlaneTakeoff className="inline h-5 w-5 mx-1"/> {flight.arrivalAirport || 'N/A'}
                                </span>
                                <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                                    {flight.flightNumber || 'N/A'}
                                </span>
                            </CardTitle>
                             <CardDescription className="flex items-center gap-1 text-sm pt-1">
                                 <Building className="h-4 w-4"/> {flight.airline || 'N/A'}
                             </CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-2">
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Departs: {formatDisplayDateTime(flight.departureTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Arrives: {formatDisplayDateTime(flight.arrivalTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                <span>Duration: {formatDuration(flight.durationMinutes)}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span className="font-semibold">Total Price: ${flight.priceUSD ? flight.priceUSD.toFixed(2) : 'N/A'}</span>
                                {/* Add per-passenger price if needed: priceUSD / numberOfPassengers */}
                             </div>
                        </CardContent>
                         <CardFooter className="pt-4 justify-end">
                              {flight.bookingUrl ? (
                                 <Link href={flight.bookingUrl} target="_blank" rel="noopener noreferrer" passHref>
                                     <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                                         View Offer <ExternalLink className="ml-2 h-4 w-4" />
                                     </Button>
                                 </Link>
                              ) : (
                                 <Button size="sm" variant="outline" disabled>Booking Link Unavailable</Button>
                              )}
                         </CardFooter>
                    </Card>
                 ))}
            </div>
         </div>
       )}
    </div>
  );
}
