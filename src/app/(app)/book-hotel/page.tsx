"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { bookHotelReservationFromPrompt, BookHotelReservationFromPromptOutput } from "@/ai/flows/book-hotel-reservation-from-prompt";
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
import { Loader2, BedDouble, CalendarDays } from "lucide-react";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Hotel request must be at least 10 characters.",
  }),
});

// Extend the output type to include dates and task ID for display
type HotelBookingResult = BookHotelReservationFromPromptOutput & {
    checkInDate?: string;
    checkOutDate?: string;
    taskId?: string; // Added taskId
};

export default function BookHotelPage() {
  const { toast } = useToast();
   const { user } = useAuth(); // Get user from auth context
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<HotelBookingResult | null>(null); // Use extended type

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
         description: "You must be signed in to book a hotel.",
         variant: "destructive",
       });
       return;
     }

    setIsLoading(true);
    setResult(null);
    try {
      // Pass the user's UID to the flow
      const response = await bookHotelReservationFromPrompt({
          prompt: data.prompt,
          userId: user.uid,
      });
      setResult(response); // The flow now returns dates and taskId too
      toast({
        title: "Hotel Booking Processed",
        description: `Successfully booked ${response.hotelName}. Confirmation: ${response.confirmationNumber}`,
      });
    } catch (error: any) {
      console.error("Error booking hotel:", error);
       let errorMessage = "Failed to book hotel. Please try again.";
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

  // Helper to format date string (YYYY-MM-DD) to a readable format
  const formatDate = (dateString: string | undefined): string => {
      if (!dateString) return 'N/A';
      try {
          // Adjust date parsing to prevent timezone issues if dates are consistently YYYY-MM-DD
           const parts = dateString.split('-');
           if (parts.length === 3) {
               const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
               if (!isNaN(date.getTime())) {
                  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); // Specify UTC to avoid timezone shifts
               }
           }
           // Fallback for other formats or invalid dates
           const genericDate = new Date(dateString);
           if (isNaN(genericDate.getTime())) return dateString;
           return genericDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

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
            Describe the hotel you need in the text box below. Make sure to include the **city**, **check-in & check-out dates**, and the **number of guests**. You can also add preferences like star rating or amenities.
            <br/>
            Example: "Book a 4-star hotel in New York City from October 10th 2024 to October 15th 2024 for 2 adults. Prefer a hotel near Times Square with a gym."
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
                    <FormLabel>Your Hotel Request</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Find me a hotel in Paris from March 5th to March 8th for 1 person..."
                        className="resize-none min-h-[150px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      The AI will extract the location, dates, guests, and preferences from your text.
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
                    Booking...
                  </>
                ) : (
                  "Book Hotel"
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
                <span>{formatDate(result.checkInDate)}</span> - <span>{formatDate(result.checkOutDate)}</span>
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
