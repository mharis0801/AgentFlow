"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { scheduleEmail, ScheduleEmailOutput } from "@/ai/flows/schedule-email"; // Import the new flow
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

// Zod schema for form validation on the client-side
const FormSchema = z.object({
  to: z.string().email({ message: "Please enter a valid recipient email address." }),
  subject: z.string().min(1, { message: "Subject cannot be empty." }),
  body: z.string().min(1, { message: "Email body cannot be empty." }),
  // Optional: Add scheduling fields later if needed
  // scheduleTime: z.date().optional(),
});

export default function ScheduleEmailPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ScheduleEmailOutput | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      to: "",
      subject: "",
      body: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
     if (!user) {
       toast({
         title: "Authentication Error",
         description: "You must be signed in to send an email.",
         variant: "destructive",
       });
       return;
     }

    setIsLoading(true);
    setResult(null); // Clear previous results
    try {
      // Prepare data for the flow
      const inputData = {
        ...data,
        userId: user.uid,
      };

      // Call the new flow function
      const response = await scheduleEmail(inputData);
      setResult(response);
      toast({
        title: response.success ? "Email Request Processed" : "Processing Failed",
        description: response.details,
        variant: response.success ? "default" : "destructive",
      });
       // Optionally reset form on success
       if (response.success) {
           form.reset();
       }
    } catch (error: any) {
       console.error("Error sending email:", error);
       toast({
         title: "Error",
         description: error.message || "Failed to send email. Please try again.",
         variant: "destructive",
       });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Send an Email</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>Compose Email</CardTitle>
          <CardDescription>
            Fill in the details below. The AI agent will send the email on your behalf (simulation).
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              {/* Recipient Email */}
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="recipient@example.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Meeting Follow-up" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email Body */}
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Body</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your email content here..."
                        className="resize-none min-h-[200px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                     <FormDescription>
                       Compose the main content of your email.
                     </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

               {/* Optional Scheduling Fields (Example) */}
               {/*
               <FormField
                 control={form.control}
                 name="scheduleTime"
                 render={({ field }) => (
                   <FormItem className="flex flex-col">
                     <FormLabel>Schedule for Later (Optional)</FormLabel>
                     <Popover>
                       <PopoverTrigger asChild>...</PopoverTrigger>
                       <PopoverContent>...</PopoverContent>
                     </Popover>
                     <FormMessage />
                   </FormItem>
                 )}
               />
               */}

            </CardContent>
            <CardFooter className="flex justify-end pt-6">
              <Button type="submit" disabled={isLoading || !user} className="bg-primary hover:bg-primary/90">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Email"
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
               <MailCheck className={`h-5 w-5 ${result.success ? 'text-green-600' : 'text-destructive'}`} />
                Sending Result
             </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={result.success ? "text-green-600 font-medium" : "text-destructive font-medium"}>
              Status: {result.success ? "Successfully Sent" : "Failed to Send"}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">Details: {result.details}</p>
            {result.messageId && result.success && (
               <p className="mt-1 text-xs text-muted-foreground">Message ID: {result.messageId}</p>
            )}
             {result.taskId && (
                 <p className="mt-1 text-xs text-muted-foreground">Task ID: {result.taskId}</p>
             )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
