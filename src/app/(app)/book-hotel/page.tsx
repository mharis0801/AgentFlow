"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, BedDouble, CalendarDays } from "lucide-react";

import { bookHotelReservation, BookHotelReservationOutput } from "@/ai/flows/book-hotel-reservation-from-prompt"; // Renamed import
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
}).refine(data => data.checkInDate < data.checkOutDate, {
  message: "Check-out date must be after check-in date.",
  path: ["checkOutDate"], // Associate error with checkOutDate field
});

type HotelBookingResult = BookHotelReservationOutput & {
    checkInDate?: string;
    checkOutDate?: string;
    taskId?: string;
};

export default function BookHotelPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<HotelBookingResult | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      city: "",
      numberOfGuests: 1,
      // Initialize dates as undefined or null
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
        title: "Hotel Booking Processed",
        description: `Successfully booked ${response.hotelName}. Confirmation: ${response.confirmationNumber}`,
      });
    } catch (error: any) {
      console.error("Error booking hotel:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to book hotel. Please try again.",
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
           const parts = dateString.split('-');
           if (parts.length === 3) {
               const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
               if (!isNaN(date.getTime())) {
                  return format(date, 'PPP'); // e.g., October 10th, 2024
               }
           }
           return dateString; // Fallback if not YYYY-MM-DD
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
            Enter your desired hotel details below. The AI will find and book the best available option based on your criteria.
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
                               "w-full pl-3 text-left font-normal",
                               !field.value && "text-muted-foreground"
                             )}
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
                               "w-full pl-3 text-left font-normal",
                               !field.value && "text-muted-foreground"
                             )}
                             disabled={!form.watch('checkInDate')} // Disable if check-in not selected
                           >
                             {field.value ? (
                               format(field.value, "PPP")
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
                  "Find & Book Hotel"
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
               <BedDouble className="h-5 w-5 text-green-600" /> Booking Confirmation
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <p><strong>Hotel Name:</strong> {result.hotelName}</p>
             <p><strong>Confirmation Number:</strong> <span className="font-mono bg-muted px-2 py-1 rounded">{result.confirmationNumber}</span></p>
             <div className="flex items-center gap-2 text-muted-foreground pt-2">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDisplayDate(result.checkInDate)}</span> - <span>{formatDisplayDate(result.checkOutDate)}</span>
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
