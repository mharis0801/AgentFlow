"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlaneTakeoff, CheckCircle } from "lucide-react";
import { Flight } from "@/services/flight-booking"; // Import Flight type
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Flight request must be at least 10 characters.",
  }),
});

// Extend the output type to include task ID
type FlightBookingResult = FindAndBookFlightsOutput & {
    taskId?: string;
};

export default function BookFlightPage() {
  const { toast } = useToast();
   const { user } = useAuth(); // Get user from auth context
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<FlightBookingResult | null>(null); // Use extended type

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      prompt: "",
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
       // Pass the user's UID to the flow
      const response = await findAndBookFlights({
          prompt: data.prompt,
          userId: user.uid,
       });
      setResult(response);
      toast({
        title: "Flight Booking Processed",
        description: response.bookingConfirmation,
      });
    } catch (error: any) {
      console.error("Error booking flight:", error);
       let errorMessage = "Failed to book flight. Please try again.";
       try {
          if (error?.message) {
            // Check if it looks like a JSON string before parsing
            if (error.message.trim().startsWith('{') && error.message.trim().endsWith('}')) {
                const parsedError = JSON.parse(error.message);
                 if (parsedError?.message) {
                    errorMessage = parsedError.message;
                 }
            } else {
                 // Use the message directly if it's not JSON
                 errorMessage = error.message;
            }
          }
       } catch (parseError) {
         // If parsing fails or original message is missing, use the original error message if available
         if (error?.message) {
             errorMessage = error.message;
         }
       }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const formatTime = (timeString: string) => {
     try {
        // Basic check for HH:MM format
        if (!/^\d{1,2}:\d{2}$/.test(timeString)) {
            return timeString; // Return original if format is unexpected
        }
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours, 10));
        date.setMinutes(parseInt(minutes, 10));
        // Check if date is valid after setting hours/minutes
        if (isNaN(date.getTime())) {
            return timeString;
        }
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }); // Use 12-hour format
     } catch {
        return timeString; // Return original string if formatting fails
     }
  };


  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Find & Book Flights</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>AI Flight Booker</CardTitle>
          <CardDescription>
            Describe the flight you're looking for. Include origin, destination, departure date, number of passengers, and any preferences (e.g., airline, direct flight). The AI will find options and book the best fit.
            Example: "Find a direct flight from New York (JFK) to Los Angeles (LAX) on December 1st 2024 for 1 passenger. Prefer morning departure."
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="prompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Your Flight Request</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Book a round trip flight from London to Tokyo..."
                        className="resize-none min-h-[150px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Specify origin, destination, dates, passengers, and preferences.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
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
