
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, PlaneTakeoff, CheckCircle, Building, Clock, Ticket, Users, DollarSign, AlertCircle } from "lucide-react";

import { findAndBookFlights, FindAndBookFlightsOutput } from "@/ai/flows/find-and-book-flights";
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

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  departureCity: z.string().min(1, { message: "Departure city/airport is required." }),
  arrivalCity: z.string().min(1, { message: "Arrival city/airport is required." }),
  departureDate: z.date({ required_error: "Departure date is required." }),
  numberOfPassengers: z.coerce.number().int().positive({ message: "Number of passengers must be a positive number." }),
});

// Combine output type with task ID
type FlightBookingResult = FindAndBookFlightsOutput & {
    taskId?: string;
};

export default function BookFlightPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<FlightBookingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
          description: "You must be signed in to book a flight.",
          variant: "destructive",
        });
        return;
      }

    setIsLoading(true);
    setResult(null);
    setError(null); // Clear previous errors
    try {
        // Format date to YYYY-MM-DD string before sending
        const inputData = {
            ...data,
            departureDate: format(data.departureDate, 'yyyy-MM-dd'),
            userId: user.uid,
        };

       // Call the refactored flow function
      const response = await findAndBookFlights(inputData);
      setResult(response);
      toast({
        title: "Flight Booking Successful",
        description: response.bookingMessage,
      });
    } catch (error: any) {
      console.error("Detailed error booking flight:", error); // Log the full error object
      // Attempt to get a more specific message
      let errorMessage = "An unexpected error occurred while booking the flight.";
      if (error instanceof Error) {
         errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
         errorMessage = error;
      } else if (error?.details) {
          // Handle potential structured errors if the backend sends them
          errorMessage = error.details;
      }
      setError(errorMessage); // Set error state
      toast({
        title: "Flight Booking Failed",
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
           // Format as Oct 10, 2024, 9:00 AM (local time)
           return format(date, "PPp");
       } catch {
           return dateTimeString; // Fallback
       }
   };

   // Format duration in minutes to hours and minutes string
   const formatDuration = (minutes: number | undefined): string => {
     if (minutes === undefined || minutes < 0) return 'N/A';
     const hours = Math.floor(minutes / 60);
     const mins = minutes % 60;
     return `${hours}h ${mins}m`;
   };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Find & Book Flights</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>AI Flight Booker</CardTitle>
          <CardDescription>
            Enter your flight details below. The AI will find available options and book the best fit (simulation).
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
                    <FormLabel>Number of Passengers</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g., 1" {...field} disabled={isLoading} />
                    </FormControl>
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
                    Searching & Booking...
                  </>
                ) : (
                   <>
                     <PlaneTakeoff className="mr-2 h-4 w-4"/> Find & Book Flight
                   </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {error && !isLoading && (
          <Card className="max-w-2xl mx-auto mt-8 shadow-md border-destructive/50 bg-destructive/10">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                      <AlertCircle className="h-5 w-5" /> Booking Error
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-destructive">{error}</p>
              </CardContent>
          </Card>
      )}

      {result && !error && !isLoading && (
        <Card className="max-w-2xl mx-auto mt-8 shadow-md border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
               <CheckCircle className="h-5 w-5" /> Booking Confirmed (Simulated)
            </CardTitle>
             <CardDescription>{result.bookingMessage}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="p-4 border rounded-lg bg-muted/50">
                 <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-lg text-primary">
                        {result.bookedFlight.departureAirport} <PlaneTakeoff className="inline h-5 w-5 mx-1"/> {result.bookedFlight.arrivalAirport}
                    </span>
                     <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                         {result.bookedFlight.flightNumber}
                     </span>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                     <div className="flex items-center gap-2">
                         <Building className="h-4 w-4 text-muted-foreground" />
                         <span>Airline: {result.bookedFlight.airline}</span>
                     </div>
                      <div className="flex items-center gap-2">
                         <Ticket className="h-4 w-4 text-muted-foreground" />
                         <span className="font-medium">Confirmation: <span className="font-mono bg-muted px-1 rounded">{result.confirmationNumber}</span></span>
                     </div>
                      <div className="flex items-center gap-2">
                         <Clock className="h-4 w-4 text-muted-foreground" />
                         <span>Departs: {formatDisplayDateTime(result.bookedFlight.departureTime)}</span>
                      </div>
                     <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Arrives: {formatDisplayDateTime(result.bookedFlight.arrivalTime)}</span>
                      </div>
                       <div className="flex items-center gap-2">
                         <Users className="h-4 w-4 text-muted-foreground" />
                         <span>Passengers: {form.getValues("numberOfPassengers")}</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Simulated Price/Person: ${result.bookedFlight.priceUSD.toFixed(2)}</span>
                      </div>
                     <div className="flex items-center gap-2 sm:col-span-2">
                         <Clock className="h-4 w-4 text-muted-foreground" />
                         <span>Duration: {formatDuration(result.bookedFlight.durationMinutes)}</span>
                     </div>
                 </div>
             </div>

             {result.taskId && (
                 <p className="text-xs text-muted-foreground">Task ID: {result.taskId}</p>
             )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
