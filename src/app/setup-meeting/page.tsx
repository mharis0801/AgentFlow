"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { setupMeetingFromPrompt, SetupMeetingFromPromptOutput } from "@/ai/flows/setup-meeting-from-prompt";
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
import { Loader2, CalendarCheck } from "lucide-react";

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Meeting request must be at least 10 characters.",
  }),
});

export default function SetupMeetingPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<SetupMeetingFromPromptOutput | null>(null);

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
      const response = await setupMeetingFromPrompt({ prompt: data.prompt });
      setResult(response);
      toast({
        title: "Meeting Setup Processed",
        description: response.confirmationMessage,
      });
    } catch (error: any) {
      console.error("Error setting up meeting:", error);
      // Attempt to parse a potential JSON error response from Genkit
      let errorMessage = "Failed to set up meeting. Please try again.";
      try {
         if (error?.message) {
           const parsedError = JSON.parse(error.message);
           if (parsedError?.message) {
             errorMessage = parsedError.message;
           }
         }
      } catch (parseError) {
         // Ignore if parsing fails, use default message
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
      <h1 className="text-3xl font-bold mb-6 text-foreground">Setup a Meeting</h1>

      <Card className="max-w-2xl mx-auto shadow-md">
        <CardHeader>
          <CardTitle>AI Meeting Scheduler</CardTitle>
          <CardDescription>
            Describe the meeting you want to set up. Include participants (email addresses), proposed time/date, duration, title, and optionally an agenda or location.
            Example: "Set up a 30-minute meeting with jane.smith@example.com and bob@example.com for next Tuesday at 2 PM EST titled 'Project Kickoff'. Agenda: Discuss project goals."
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
                    <FormLabel>Your Meeting Request</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Schedule a meeting with marketing@example.com..."
                        className="resize-none min-h-[150px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Be specific about attendees, time, date, duration, and title.
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
                    Processing...
                  </>
                ) : (
                  "Setup Meeting"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>

       {result && (
         <Card className="max-w-2xl mx-auto mt-8 shadow-md">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <CalendarCheck className="h-5 w-5 text-green-600" /> Meeting Details
             </CardTitle>
             <CardDescription>{result.confirmationMessage}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <p><strong>Title:</strong> {result.meetingDetails.title}</p>
             <p><strong>Attendees:</strong> {result.meetingDetails.attendees.join(', ')}</p>
             <p><strong>Starts:</strong> {new Date(result.meetingDetails.startTime).toLocaleString()}</p>
             <p><strong>Ends:</strong> {new Date(result.meetingDetails.endTime).toLocaleString()}</p>
             {result.meetingDetails.location && <p><strong>Location:</strong> {result.meetingDetails.location}</p>}
             {result.meetingDetails.agenda && <p><strong>Agenda:</strong> {result.meetingDetails.agenda}</p>}
           </CardContent>
         </Card>
       )}
    </div>
  );
}
