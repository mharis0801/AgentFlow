
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, BedDouble, CalendarDays, Users, MapPin, Star, DollarSign, AlertCircle, ExternalLink, Search } from "lucide-react";
import Link from "next/link"; // For external booking links

import { searchHotels, SearchHotelsOutput } from "@/ai/flows/search-hotels"; // Import the search flow
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
import Image from "next/image"; // Use next/image for optimized images
// import { Hotel } from "@/services/hotel-booking"; // Import if needed for explicit typing

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  city: z.string().min(1, { message: "City is required." }),
  checkInDate: z.date({ required_error: "Check-in date is required." }),
  checkOutDate: z.date({ required_error: "Check-out date is required." }),
  numberOfGuests: z.coerce.number().int().positive({ message: "Number of guests must be a positive number." }),
}).refine(data => data.checkInDate && data.checkOutDate && data.checkInDate < data.checkOutDate, {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"], // Associate error with checkOutDate field
});


// Type for the hotel search results array (using the flow's output type)
type HotelSearchResults = SearchHotelsOutput;

export default function SearchHotelPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<HotelSearchResults>([]); // Store array of hotels
  const [error, setError] = React.useState<string | null>(null);
  const [searchPerformed, setSearchPerformed] = React.useState(false); // Track if search was done


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      city: "",
      numberOfGuests: 1,
      checkInDate: undefined,
      checkOutDate: undefined,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "You must be signed in to search for hotels.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResults([]); // Clear previous results
    setError(null); // Clear previous error
    setSearchPerformed(true); // Mark that a search has been attempted

    try {
      // Format dates to YYYY-MM-DD strings before sending
      const inputData = {
        ...data,
        checkInDate: format(data.checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(data.checkOutDate, 'yyyy-MM-dd'),
        userId: user.uid,
      };

      // Call the search flow function
      const response = await searchHotels(inputData);
      setResults(response); // Set the array of hotel results
       if (response.length > 0) {
           toast({
               title: "Hotel Search Successful",
               description: `Found ${response.length} hotel options.`,
           });
       } else {
            toast({
                title: "No Hotels Found",
                description: "Your search returned no results. Try different criteria.",
                variant: "default",
            });
       }
    } catch (error: any) {
      console.error("Detailed error searching hotels:", error); // Log the full error object
       let errorMessage = "An unexpected error occurred while searching for hotels.";
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
        title: "Hotel Search Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Search Hotels</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>Hotel Finder</CardTitle>
          <CardDescription>
            Enter your desired hotel details below to search real-time availability.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* City Input */}
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Destination City</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., New York City, Paris" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription>Enter the city where you want to stay.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Check-in Date */}
               <FormField
                 control={form.control}
                 name="checkInDate"
                 render={({ field }) => (
                   <FormItem className="flex flex-col">
                     <FormLabel>Check-in Date</FormLabel>
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
                            <CalendarIcon className="mr-2 h-4 w-4"/>
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

              {/* Check-out Date */}
              <FormField
                control={form.control}
                name="checkOutDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Check-out Date</FormLabel>
                     <Popover>
                       <PopoverTrigger asChild>
                         <FormControl>
                           <Button
                             variant={"outline"}
                             className={cn(
                               "w-full justify-start text-left font-normal",
                               !field.value && "text-muted-foreground"
                             )}
                             disabled={!form.watch('checkInDate') || isLoading} // Disable if check-in not selected or loading
                           >
                              <CalendarIcon className="mr-2 h-4 w-4"/>
                             {field.value ? (
                               format(field.value, "PPP")
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
                           disabled={(date) => {
                              const checkInDate = form.watch('checkInDate');
                              // Disable dates before or on check-in date
                              return !checkInDate || date <= checkInDate;
                           }}
                           initialFocus
                         />
                       </PopoverContent>
                     </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Number of Guests */}
              <FormField
                control={form.control}
                name="numberOfGuests"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Number of Guests</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g., 2" {...field} disabled={isLoading} />
                    </FormControl>
                     <FormDescription>
                        Enter the total number of adult guests.
                     </FormDescription>
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
                    Searching...
                  </>
                ) : (
                   <>
                     <Search className="mr-2 h-4 w-4" /> Search Hotels
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
               <p className="mt-2 text-muted-foreground">Searching for hotels...</p>
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
                       <BedDouble className="h-5 w-5" /> No Hotels Found
                   </CardTitle>
               </CardHeader>
               <CardContent>
                   <p className="text-muted-foreground">No hotels matched your search criteria. Please try different dates or cities.</p>
               </CardContent>
           </Card>
       )}


       {/* Results Display */}
       {results.length > 0 && !error && !isLoading && (
          <div className="max-w-4xl mx-auto mt-8">
             <h2 className="text-2xl font-semibold mb-4 text-center text-foreground">Search Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {results.map((hotel) => (
                      <Card key={hotel.id} className="shadow-md border-primary/20 overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col">
                         <div className="relative w-full h-48 bg-muted">
                            {/* Use a placeholder or remove if images aren't reliably available */}
                            <Image
                                src={hotel.imageUrl || `https://picsum.photos/seed/${hotel.id}/300/200`} // Fallback image
                                alt={`Image of ${hotel.name}`}
                                layout="fill"
                                objectFit="cover"
                                unoptimized // Use unoptimized for picsum
                                onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${hotel.id}/300/200`; e.currentTarget.onerror = null; }} // Handle potential image load errors
                            />
                         </div>
                         <CardHeader className="pb-2">
                            <CardTitle className="text-lg text-primary">{hotel.name || 'Hotel Name Unavailable'}</CardTitle>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground pt-1">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                {/* Display rating if available and > 0 */}
                                <span>{hotel.rating && hotel.rating > 0 ? hotel.rating.toFixed(1) : 'N/A'}</span>
                            </div>
                         </CardHeader>
                         <CardContent className="text-sm space-y-1 flex-grow">
                              {hotel.description && <p className="text-muted-foreground line-clamp-2">{hotel.description}</p>}
                              <div className="flex items-center gap-1 pt-1">
                                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                                  <span className="text-xs">{hotel.address || 'Address not available'}</span>
                              </div>
                              <div className="flex items-center gap-1 pt-1">
                                 <DollarSign className="h-4 w-4 text-muted-foreground" />
                                 <span className="font-semibold">Avg Price/Night: ${hotel.pricePerNightUSD ? hotel.pricePerNightUSD.toFixed(2) : 'N/A'}</span>
                             </div>
                         </CardContent>
                          <CardFooter className="pt-4 justify-end">
                               {hotel.bookingUrl ? (
                                  <Link href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" passHref>
                                      <Button size="sm" variant="outline" className="border-primary text-primary hover:bg-primary/10">
                                          View Deal <ExternalLink className="ml-2 h-4 w-4" />
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
