"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { scheduleEmailFromPrompt, ScheduleEmailFromPromptOutput } from "@/ai/flows/schedule-email-from-prompt";
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
import { Loader2, MailCheck } from "lucide-react";

const FormSchema = z.object({
  prompt: z.string().min(10, {
    message: "Prompt must be at least 10 characters.",
  }),
});

export default function ScheduleEmailPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [result, setResult] = React.useState<ScheduleEmailFromPromptOutput | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      prompt: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);
    setResult(null); // Clear previous results
    try {
      const response = await scheduleEmailFromPrompt({ prompt: data.prompt });
      setResult(response);
      toast({
        title: response.success ? "Email Scheduled!" : "Scheduling Failed",
        description: response.details,
        variant: response.success ? "default" : "destructive",
      });
    } catch (error: any) {
       console.error("Error scheduling email:", error);
       let errorMessage = "Failed to schedule email. Please try again.";
        try {
          if (error?.message) {
             const parsedError = JSON.parse(error.message);
             if (parsedError?.message) {
               errorMessage = parsedError.message;
             }
           }
        } catch (parseError) {
          // Ignore parsing error
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
      <h1 className="text-3xl font-bold mb-6 text-foreground">Schedule an Email</h1>

      <Card className="max-w-2xl mx-auto shadow-md border-primary/20">
        <CardHeader>
          <CardTitle>AI Email Scheduler</CardTitle>
          <CardDescription>
            Describe the email you want to send, who it's for, and when. Our AI will handle the rest.
            Example: "Schedule an email to john.doe@example.com for tomorrow at 9 AM EST regarding the project update. Subject: Project Update. Body: Hi John, Please find the latest project update attached."
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
                    <FormLabel>Your Request</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Send an email to team@example.com next Monday morning..."
                        className="resize-none min-h-[150px]"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide details like recipient, subject, content, and desired sending time.
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
                    Scheduling...
                  </>
                ) : (
                  "Schedule Email"
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
                Scheduling Result
             </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={result.success ? "text-green-600 font-medium" : "text-destructive font-medium"}>
              Status: {result.success ? "Successfully Scheduled" : "Failed to Schedule"}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">Details: {result.details}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
