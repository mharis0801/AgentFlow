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
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Meeting request must be at least 10 characters.",
  }),
});

export default function SetupMeetingPage() {
  const { toast } = useToast();
  const { user } = useAuth(); // Get user from auth context
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<SetupMeetingFromPromptOutput | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      prompt: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
     // Ensure user and user.email are available
    if (!user || !user.email || !user.uid) {
      toast({
        title: "Authentication Error",
        description: "Could not identify the current user. Please sign in again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      // Pass the current user's email AND UID to the flow
      const response = await setupMeetingFromPrompt({
        prompt: data.prompt,
        currentUserEmail: user.email,
        userId: user.uid, // Pass the UID
      });
      setResult(response);
      toast({
        title: "Meeting Setup Processed",
        description: response.confirmationMessage,
        // Optionally use success/failure from response if available
        variant: response.inviteSent || response.confirmationMessage.includes("extracted") ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Error setting up meeting:", error);
      // Attempt to parse a potential JSON error response from Genkit
      let errorMessage = "Failed to set up meeting. Please try again.";
      try {
         if (error?.message) {
           // Attempt to parse only if it looks like a JSON string
           if (error.message.trim().startsWith('{') && error.message.trim().endsWith('}')) {
             const parsedError = JSON.parse(error.message);
             if (parsedError?.message) {
               errorMessage = parsedError.message;
             }
           } else {
             errorMessage = error.message; // Use the message directly if not JSON
           }
         }
      } catch (parseError) {
         // Ignore if parsing fails, use default message or original error message
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

   // Helper to format ISO date string or potentially other formats
   const formatDate = (dateString: string | undefined): string => {
       if (!dateString) return 'N/A';
       try {
           const date = new Date(dateString);
           if (isNaN(date.getTime())) return dateString; // Return original if invalid
           return date.toLocaleString(undefined, {
               dateStyle: 'medium', // e.g., Oct 10, 2023
               timeStyle: 'short', // e.g., 2:00 PM
           });
       } catch {
           return dateString; // Fallback
       }
   };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Setup a Meeting</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
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
                      Be specific about attendees, time, date, duration, and title. The AI understands timezones like EST, PST etc.
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
         <Card className="max-w-2xl mx-auto mt-8 shadow-md border-primary/20">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <CalendarCheck className="h-5 w-5 text-green-600" /> Meeting Details
             </CardTitle>
             <CardDescription>{result.confirmationMessage}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <p><strong>Title:</strong> {result.meetingDetails.title}</p>
             <p><strong>Attendees:</strong> {result.meetingDetails.attendees.join(', ')}</p>
             <p><strong>Starts:</strong> {formatDate(result.meetingDetails.startTime)}</p>
             <p><strong>Ends:</strong> {formatDate(result.meetingDetails.endTime)}</p>
             {result.meetingDetails.location && <p><strong>Location:</strong> {result.meetingDetails.location}</p>}
             {result.meetingDetails.agenda && <p><strong>Agenda:</strong> {result.meetingDetails.agenda}</p>}
             <p><strong>Invite Sent:</strong> {result.inviteSent ? 'Yes' : 'No'}</p>
              {result.taskId && (
                   <p className="mt-1 text-xs text-muted-foreground">Task ID: {result.taskId}</p>
              )}
           </CardContent>
         </Card>
       )}
    </div>
  );
}
