"use client"; // Required because we use Link and hooks

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, Plane, Hotel, PlusCircle } from 'lucide-react';
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth

export default function DashboardPage() { // Changed component name
  const { user } = useAuth(); // Get user info if needed

  const quickActions = [
    { href: "/schedule-email", label: "Schedule Email", icon: Mail },
    { href: "/setup-meeting", label: "Setup Meeting", icon: Calendar },
    { href: "/book-hotel", label: "Book Hotel", icon: Hotel },
    { href: "/book-flight", label: "Book Flight", icon: Plane },
  ];

  return (
    <div className="container mx-auto py-8">
       <h1 className="text-3xl font-bold mb-1 text-foreground">Welcome, {user?.displayName || 'User'}!</h1>
       <p className="text-muted-foreground mb-6">Manage your tasks and bookings.</p>


      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Start a new task with one click.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link href={action.href} key={action.href} passHref>
              <Button variant="outline" className="w-full h-24 flex flex-col items-center justify-center gap-2 transition-all-subtle hover:bg-accent hover:text-accent-foreground hover:shadow-lg border-primary/20">
                <action.icon className="h-8 w-8 text-primary" />
                <span>{action.label}</span>
              </Button>
            </Link>
          ))}
        </CardContent>
      </Card>

       <Card className="shadow-md border-primary/20">
         <CardHeader>
           <CardTitle>Upcoming Tasks & Bookings</CardTitle>
           <CardDescription>View your scheduled emails, meetings, and confirmed bookings.</CardDescription>
         </CardHeader>
         <CardContent>
           {/* Placeholder for displaying upcoming items */}
           <div className="text-center text-muted-foreground py-12">
             <p>No upcoming tasks or bookings found.</p>
             <p className="mt-2">Use the quick actions above to get started!</p>
             {/* Example of adding a new task directly */}
             {/* <Button variant="link" className="mt-4 text-primary">
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Task
             </Button> */}
           </div>
           {/* Add logic here to fetch and display actual data from Firestore */}
         </CardContent>
       </Card>
    </div>
  );
}
