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
import { Loader2, BedDouble } from "lucide-react";

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Hotel request must be at least 10 characters.",
  }),
});

export default function BookHotelPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<BookHotelReservationFromPromptOutput | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      prompt: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setResult(null);
    try {
      const response = await bookHotelReservationFromPrompt({ prompt: data.prompt });
      setResult(response);
      toast({
        title: "Hotel Booking Processed",
        description: `Successfully booked ${response.hotelName}. Confirmation: ${response.confirmationNumber}`,
      });
    } catch (error: any) {
      console.error("Error booking hotel:", error);
       let errorMessage = "Failed to book hotel. Please try again.";
       try {
          if (error?.message) {
            // Genkit might wrap errors in JSON strings
            const parsedError = JSON.parse(error.message);
             if (parsedError?.message) {
              errorMessage = parsedError.message;
             }
          }
       } catch (parseError) {
          // Ignore parsing errors
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

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Book a Hotel</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>AI Hotel Booker</CardTitle>
          <CardDescription>
            Describe the hotel you need. Include the city, check-in/check-out dates, number of guests, and any preferences (e.g., star rating, amenities).
            Example: "Book a 4-star hotel in New York City from October 10th to October 15th for 2 adults. Prefer a hotel near Times Square with a gym."
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
                        placeholder="e.g., Find me a hotel in Paris for 3 nights next month..."
                        className="resize-none min-h-[150px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific about location, dates, guests, and preferences.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
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
           </CardContent>
         </Card>
       )}
    </div>
  );
}
