
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon, Loader2, CalendarCheck, Clock } from "lucide-react";

import { setupMeeting, SetupMeetingOutput } from "@/ai/flows/setup-meeting-from-prompt"; // Renamed import
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
import { Textarea } from "@/components/ui/textarea"; // For Agenda
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  title: z.string().min(1, { message: 'Meeting title is required.' }),
  // Input as string, validated as array of emails in the flow
  attendees: z.string().min(1, { message: 'At least one attendee email is required.' })
              .refine(value => value.split(/[\s,]+/).every(email => z.string().email().safeParse(email.trim()).success),
                      { message: "Please enter valid email addresses separated by commas or spaces." }),
  // Use Date objects for pickers, convert to ISO string before sending
  startDate: z.date({ required_error: "Meeting date is required." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format. Use HH:MM (24-hour)."}),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time format. Use HH:MM (24-hour)."}),
  location: z.string().optional(),
  agenda: z.string().optional(),
}).refine(data => {
    // Combine date and time for comparison
    const startDateTime = new Date(data.startDate);
    const [startHours, startMinutes] = data.startTime.split(':').map(Number);
    startDateTime.setHours(startHours, startMinutes, 0, 0);

    const endDateTime = new Date(data.startDate); // Assume same date for simplicity, adjust if allowing multi-day
    const [endHours, endMinutes] = data.endTime.split(':').map(Number);
    endDateTime.setHours(endHours, endMinutes, 0, 0);

    return startDateTime < endDateTime;
}, {
    message: "End time must be after start time on the same day.",
    path: ["endTime"], // Associate error with endTime field
});

export default function SetupMeetingPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<SetupMeetingOutput | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      title: "",
      attendees: "",
      startDate: undefined,
      startTime: "09:00", // Default start time
      endTime: "09:30",   // Default end time (30 min duration)
      location: "",
      agenda: "",
    },
  });

  // Combine date and time into ISO string UTC
  const combineDateAndTime = (date: Date, time: string): string => {
      const [hours, minutes] = time.split(':').map(Number);
      const combinedDate = new Date(date);
      combinedDate.setHours(hours, minutes, 0, 0);
      // Important: Convert to UTC ISO string for the backend flow
      return combinedDate.toISOString();
  };

  async function onSubmit(data: z.infer<typeof FormSchema>) {
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
       // Prepare data for the backend flow
      const inputData = {
        title: data.title,
        // Split string attendees into an array for the flow
        attendees: data.attendees.split(/[\s,]+/).map(email => email.trim()).filter(Boolean),
        startTime: combineDateAndTime(data.startDate, data.startTime),
        endTime: combineDateAndTime(data.startDate, data.endTime), // Assume same date
        location: data.location,
        agenda: data.agenda,
        currentUserEmail: user.email,
        userId: user.uid,
      };

      // Call the refactored flow function
      const response = await setupMeeting(inputData);
      setResult(response);
      toast({
        title: "Meeting Setup Processed",
        description: response.confirmationMessage,
        variant: response.inviteSent || !response.confirmationMessage.toLowerCase().includes("failed") ? "default" : "destructive",
      });
    } catch (error: any) {
      console.error("Detailed error setting up meeting:", error); // Log the full error object
      // Attempt to get a more specific message
      let errorMessage = "An unexpected error occurred while setting up the meeting.";
      if (error instanceof Error) {
         errorMessage = error.message || errorMessage;
      } else if (typeof error === 'string') {
         errorMessage = error;
      } else if (error?.details) {
          // Handle potential structured errors if the backend sends them
          errorMessage = error.details;
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

   // Helper to format ISO date string for display
   const formatDisplayDateTime = (dateString: string | undefined): string => {
       if (!dateString) return 'N/A';
       try {
           const date = new Date(dateString);
           if (isNaN(date.getTime())) return dateString;
           return format(date, "PPP p"); // e.g., Oct 10, 2023 9:00 AM
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
            Fill in the details below to schedule a meeting. The AI will send out simulated invites.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Meeting Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Project Kickoff, Weekly Sync" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Attendees */}
              <FormField
                control={form.control}
                name="attendees"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attendees (Emails)</FormLabel>
                    <FormControl>
                       <Input placeholder="e.g., colleague@example.com, team@example.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormDescription>
                       Enter email addresses separated by commas or spaces.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Meeting Date */}
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col sm:col-span-1">
                      <FormLabel>Date</FormLabel>
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

                 {/* Start Time */}
                 <FormField
                   control={form.control}
                   name="startTime"
                   render={({ field }) => (
                     <FormItem className="sm:col-span-1">
                       <FormLabel>Start Time (HH:MM)</FormLabel>
                       <FormControl>
                         <div className="relative">
                           <Input type="time" {...field} disabled={isLoading} className="pr-8" />
                            <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                         </div>
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />

                 {/* End Time */}
                 <FormField
                   control={form.control}
                   name="endTime"
                   render={({ field }) => (
                     <FormItem className="sm:col-span-1">
                       <FormLabel>End Time (HH:MM)</FormLabel>
                       <FormControl>
                          <div className="relative">
                            <Input type="time" {...field} disabled={isLoading} className="pr-8" />
                             <Clock className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          </div>
                       </FormControl>
                       <FormMessage />
                     </FormItem>
                   )}
                 />
              </div>


              {/* Location (Optional) */}
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Conference Room A, Google Meet link" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Agenda (Optional) */}
              <FormField
                control={form.control}
                name="agenda"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agenda / Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly describe the meeting's purpose..."
                        className="resize-none"
                        {...field}
                        disabled={isLoading}
                      />
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
                    Scheduling...
                  </>
                ) : (
                  "Schedule Meeting"
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
               <CalendarCheck className={`h-5 w-5 ${result.inviteSent ? 'text-green-600' : 'text-orange-500'}`} /> Meeting Details
             </CardTitle>
             <CardDescription>{result.confirmationMessage}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-2 text-sm">
             <p><strong>Title:</strong> {result.meetingDetails.title}</p>
             <p><strong>Attendees:</strong> {result.meetingDetails.attendees.join(', ')}</p>
             <p><strong>Starts:</strong> {formatDisplayDateTime(result.meetingDetails.startTime)}</p>
             <p><strong>Ends:</strong> {formatDisplayDateTime(result.meetingDetails.endTime)}</p>
             {result.meetingDetails.location && <p><strong>Location:</strong> {result.meetingDetails.location}</p>}
             {result.meetingDetails.agenda && <p><strong>Agenda:</strong> {result.meetingDetails.agenda}</p>}
             <p><strong>Invite Sent:</strong> {result.inviteSent ? 'Yes (Simulated)' : 'No / Failed'}</p>
              {result.taskId && (
                   <p className="mt-1 text-xs text-muted-foreground">Task ID: {result.taskId}</p>
              )}
           </CardContent>
         </Card>
       )}
    </div>
  );
}
