"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, PlaneTakeoff, CheckCircle } from "lucide-react";

import { findAndBookFlights, FindAndBookFlightsOutput } from "@/ai/flows/find-and-book-flights"; // Renamed import
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
import { Flight } from "@/services/flight-booking";
import { cn } from "@/lib/utils";

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  departureCity: z.string().min(1, { message: "Departure city/airport is required." }),
  arrivalCity: z.string().min(1, { message: "Arrival city/airport is required." }),
  departureDate: z.date({ required_error: "Departure date is required." }),
  numberOfPassengers: z.coerce.number().int().positive({ message: "Number of passengers must be a positive number." }),
});

type FlightBookingResult = FindAndBookFlightsOutput & {
    taskId?: string;
};

export default function BookFlightPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<FlightBookingResult | null>(null);

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
        title: "Flight Booking Processed",
        description: response.bookingConfirmation,
      });
    } catch (error: any) {
      console.error("Error booking flight:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to book flight. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const formatTime = (timeString: string) => {
     try {
        if (!/^\d{1,2}:\d{2}$/.test(timeString)) return timeString;
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10));
        date.setMinutes(parseInt(minutes, 10));
        if (isNaN(date.getTime())) return timeString;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
     } catch {
        return timeString;
     }
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
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            disabled={isLoading}
                          >
                            {field.value ? (
                              format(field.value, "PPP") // Display format
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                  "Find & Book Flight"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

      {result && (
        <Card className="max-w-2xl mx-auto mt-8 shadow-md border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
               <CheckCircle className="h-5 w-5 text-green-600" /> Booking Result
            </CardTitle>
            <CardDescription>{result.bookingConfirmation}</CardDescription>
          </CardHeader>
          <CardContent>
            <h3 className="font-semibold mb-2">Available Flights Found:</h3>
            {result.flights.length > 0 ? (
              <ul className="space-y-3">
                {result.flights.map((flight: Flight, index: number) => (
                  <li key={index} className="p-3 border rounded-md bg-muted/50 text-sm">
                    <div className="flex justify-between items-center font-medium mb-1">
                      <span>{flight.departureAirport} <PlaneTakeoff className="inline h-4 w-4 mx-1 text-primary"/> {flight.arrivalAirport}</span>
                      <span className="font-mono text-primary">{flight.flightNumber}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span>Depart: {formatTime(flight.departureTime)}</span> | <span>Arrive: {formatTime(flight.arrivalTime)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No specific flight options were returned by the AI for this request.</p>
            )}
             {result.taskId && (
                 <p className="mt-4 text-xs text-muted-foreground">Task ID: {result.taskId}</p>
             )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
