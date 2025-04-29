"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase/firebase";
import { upsertUser } from "@/services/firestore"; // Import upsertUser
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

// Inline SVG for Google icon
const GoogleIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.712,34.806,44,29.865,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
  </svg>
);

const FormSchema = z.object({
  displayName: z.string().min(2, { message: "Display name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function SignUpPage() {
  const { toast } = useToast();
  const router = useRouter();
   const { user } = useAuth();
  const [isLoadingEmail, setIsLoadingEmail] = React.useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = React.useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

   // Redirect if user is already logged in
   React.useEffect(() => {
     if (user) {
       router.push("/");
     }
   }, [user, router]);

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoadingEmail(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      // Set display name
      await updateProfile(userCredential.user, { displayName: data.displayName });
      // User is created and signed in, upsert data
      await upsertUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: data.displayName, // Use the name from the form
      });
      toast({
        title: "Account Created Successfully",
        description: "Welcome to AgentFlow!",
      });
      router.push("/"); // Redirect to dashboard
    } catch (error: any) {
      console.error("Error signing up with email:", error);
      // Handle specific error codes like 'auth/email-already-in-use'
      let errorMessage = "An error occurred. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
         errorMessage = "This email address is already in use. Please sign in or use a different email.";
      } else if (error.message) {
         errorMessage = error.message;
      }
      toast({
        title: "Sign Up Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoadingEmail(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoadingGoogle(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // User is signed in, upsert data (Firestore function handles new/existing users)
      await upsertUser(result.user);
      toast({
        title: "Sign In Successful",
        description: `Welcome, ${result.user.displayName}!`,
      });
      router.push("/"); // Redirect to dashboard
    } catch (error: any) {
      console.error("Error signing up/in with Google:", error);
       if (error.code === 'auth/popup-closed-by-user') {
        toast({
          title: "Sign Up Cancelled",
          description: "Google Sign-Up was cancelled.",
          variant: "default",
        });
      } else {
         toast({
           title: "Google Sign Up Failed",
           description: error.message || "An error occurred. Please try again.",
           variant: "destructive",
         });
      }
    } finally {
      setIsLoadingGoogle(false);
    }
  }

   // Render nothing or a loading indicator if user is already logged in and redirecting
   if (user) {
     return (
       <div className="flex h-screen w-screen items-center justify-center bg-background">
         <Loader2 className="h-16 w-16 animate-spin text-primary" />
         <p className="ml-4 text-muted-foreground">Redirecting...</p>
       </div>
     );
   }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <Card className="w-full max-w-md shadow-xl border-primary/20">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Create an Account</CardTitle>
          <CardDescription>Join AgentFlow and automate your tasks.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} disabled={isLoadingEmail || isLoadingGoogle} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@example.com" {...field} disabled={isLoadingEmail || isLoadingGoogle} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isLoadingEmail || isLoadingGoogle} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoadingEmail || isLoadingGoogle}>
                {isLoadingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign Up
              </Button>
            </form>
          </Form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full border-foreground/20 hover:bg-accent hover:text-accent-foreground"
            onClick={handleGoogleSignIn}
            disabled={isLoadingEmail || isLoadingGoogle}
          >
             {isLoadingGoogle ? (
               <Loader2 className="mr-2 h-4 w-4 animate-spin" />
             ) : (
               <GoogleIcon />
             )}
             <span className="ml-2">Sign up with Google</span>
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/signin" className="font-medium text-primary hover:underline">
              Sign In
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
