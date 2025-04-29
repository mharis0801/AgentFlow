"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, BedDouble, CalendarDays, CheckCircle, Users, MapPin, Star, DollarSign, AlertCircle } from "lucide-react";

import { bookHotelReservation, BookHotelReservationOutput } from "@/ai/flows/book-hotel-reservation-from-prompt";
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
  city: z.string().min(1, { message: "City is required." }),
  checkInDate: z.date({ required_error: "Check-in date is required." }),
  checkOutDate: z.date({ required_error: "Check-out date is required." }),
  numberOfGuests: z.coerce.number().int().positive({ message: "Number of guests must be a positive number." }),
}).refine(data => data.checkInDate && data.checkOutDate && data.checkInDate < data.checkOutDate, {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"], // Associate error with checkOutDate field
});


// Combine output type with task ID
type HotelBookingResult = BookHotelReservationOutput & {
    taskId?: string;
    // Add fields that might be in the details but not top-level in output
    address?: string;
    rating?: number;
    pricePerNightUSD?: number;
};

export default function BookHotelPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<HotelBookingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

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
        description: "You must be signed in to book a hotel.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    setError(null); // Clear previous error
    try {
      // Format dates to YYYY-MM-DD strings before sending
      const inputData = {
        ...data,
        checkInDate: format(data.checkInDate, 'yyyy-MM-dd'),
        checkOutDate: format(data.checkOutDate, 'yyyy-MM-dd'),
        userId: user.uid,
      };

      // Call the refactored flow function
      const response = await bookHotelReservation(inputData);
      setResult(response);
      toast({
        title: "Hotel Booking Successful",
        description: response.message, // Use message from response
      });
    } catch (error: any) {
      console.error("Error booking hotel:", error);
      const errorMessage = error.message || "Failed to book hotel. Please try again.";
      setError(errorMessage); // Set error state
      toast({
        title: "Hotel Booking Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Helper to format date string (YYYY-MM-DD) to a readable format
  const formatDisplayDate = (dateString: string | undefined): string => {
      if (!dateString) return 'N/A';
      try {
           // Check if it's already a formatted string or needs parsing
           if (!dateString.includes(',')) { // Basic check if not already formatted like "Oct 10th, 2024"
               const parts = dateString.split('-');
               if (parts.length === 3) {
                   const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                   if (!isNaN(date.getTime())) {
                      return format(date, 'PPP'); // e.g., October 10th, 2024
                   }
               }
           }
           return dateString; // Return as is if format is unexpected or already formatted
      } catch {
          return dateString; // Fallback
      }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Book a Hotel</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>AI Hotel Booker</CardTitle>
          <CardDescription>
            Enter your desired hotel details below. The AI will find and book the best available option (simulation).
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
                        Enter the total number of guests.
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
                    Booking...
                  </>
                ) : (
                   <>
                     <BedDouble className="mr-2 h-4 w-4" /> Find & Book Hotel
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
               <CheckCircle className="h-5 w-5" /> Reservation Confirmed (Simulated)
             </CardTitle>
             <CardDescription>{result.message}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/50">
                     <div className="flex justify-between items-start mb-2">
                         <div>
                             <h3 className="font-semibold text-lg text-primary">{result.hotelName}</h3>
                             {result.address && (
                                 <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                     <MapPin className="h-4 w-4" />
                                     <span>{result.address}</span>
                                 </div>
                             )}
                         </div>
                         <span className="text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded">
                            {result.confirmationNumber}
                         </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span>Check-in: {formatDisplayDate(result.checkInDate)}</span>
                        </div>
                         <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            <span>Check-out: {formatDisplayDate(result.checkOutDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>Guests: {result.numberOfGuests}</span>
                        </div>
                         {result.rating !== undefined && (
                            <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                <span>Rating: {result.rating.toFixed(1)}</span>
                            </div>
                         )}
                         {result.pricePerNightUSD !== undefined && (
                            <div className="flex items-center gap-1 sm:col-span-2">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <span>Simulated Price/Night: ${result.pricePerNightUSD.toFixed(2)}</span>
                            </div>
                         )}
                    </div>
               </div>
              {result.taskId && (
                  <p className="mt-1 text-xs text-muted-foreground">Task ID: {result.taskId}</p>
              )}
           </CardContent>
         </Card>
       )}
    </div>
  );
}
