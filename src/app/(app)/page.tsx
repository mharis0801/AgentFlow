"use client"; // Required because we use Link and hooks

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Calendar, Plane, Hotel, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context"; // Import useAuth
import { db } from "@/lib/firebase/firebase"; // Import Firestore instance
import { collection, query, where, orderBy, onSnapshot, DocumentData, Timestamp } from "firebase/firestore";
import { format } from 'date-fns'; // For formatting dates

// Define interfaces for the data structures
interface ScheduledItemBase {
  id: string;
  userId: string;
  type: 'email' | 'meeting' | 'hotel' | 'flight';
  createdAt: Timestamp;
  status: string; // e.g., 'scheduled', 'confirmed', 'failed'
  details: Record<string, any>; // Flexible details object
}

interface ScheduledEmail extends ScheduledItemBase {
  type: 'email';
  details: {
    to: string;
    subject: string;
    scheduledTime?: Timestamp; // Optional: if scheduling is supported
    messageId?: string;
  };
}

interface ScheduledMeeting extends ScheduledItemBase {
  type: 'meeting';
  details: {
    title: string;
    attendees: string[];
    startTime: Timestamp;
    endTime: Timestamp;
    location?: string;
  };
}

interface BookedHotel extends ScheduledItemBase {
  type: 'hotel';
  details: {
    hotelName: string;
    confirmationNumber: string;
    checkInDate: string; // Store as string YYYY-MM-DD
    checkOutDate: string; // Store as string YYYY-MM-DD
  };
}

interface BookedFlight extends ScheduledItemBase {
  type: 'flight';
  details: {
    flightNumber: string;
    departureAirport: string;
    arrivalAirport: string;
    departureTime: string; // Store as string YYYY-MM-DD HH:MM
    arrivalTime: string; // Store as string YYYY-MM-DD HH:MM
    confirmationMessage?: string; // Might be part of the response
  };
}

type ScheduledItem = ScheduledEmail | ScheduledMeeting | BookedHotel | BookedFlight;


export default function DashboardPage() {
  const { user } = useAuth();
  const [upcomingItems, setUpcomingItems] = useState<ScheduledItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quickActions = [
    { href: "/schedule-email", label: "Schedule Email", icon: Mail },
    { href: "/setup-meeting", label: "Setup Meeting", icon: Calendar },
    { href: "/book-hotel", label: "Book Hotel", icon: Hotel },
    { href: "/book-flight", label: "Book Flight", icon: Plane },
  ];

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return; // No user, no data to fetch
    }

    setIsLoading(true);
    setError(null);

    // Reference to a 'tasks' collection (or similar name you choose)
    // We assume items are stored with a 'userId' field matching the authenticated user's UID.
    const tasksCollectionRef = collection(db, "agentTasks"); // CHANGE "agentTasks" if needed

    // Query to get tasks for the current user, ordered by creation time (or a scheduled time if available)
    const q = query(
      tasksCollectionRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc") // Show newest first, adjust if needed
      // limit(10) // Optionally limit the number of items shown
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: ScheduledItem[] = [];
      querySnapshot.forEach((doc) => {
        // Ensure createdAt is handled correctly if it's a Firestore Timestamp
        const data = doc.data() as DocumentData;
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(); // Fallback

        items.push({
          id: doc.id,
          ...data,
          createdAt: createdAt, // Make sure createdAt is a Timestamp
        } as ScheduledItem); // Cast to the union type
      });
      setUpcomingItems(items);
      setIsLoading(false);
    }, (err) => {
      console.error("Error fetching upcoming items:", err);
      setError("Failed to load tasks. Please try again later.");
      setIsLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();

  }, [user]); // Re-run effect when user changes

  // Helper to format Firestore Timestamps or date strings
   const formatDate = (dateInput: Timestamp | string | undefined): string => {
      if (!dateInput) return 'N/A';
      try {
          if (dateInput instanceof Timestamp) {
              return format(dateInput.toDate(), 'PPp'); // Format Timestamp (e.g., Oct 10, 2023, 9:00:00 AM)
          }
          // Try parsing string dates (assuming YYYY-MM-DD or ISO format)
          const date = new Date(dateInput);
          if (isNaN(date.getTime())) return dateInput; // Return original if invalid
          // Check if it's just a date (like YYYY-MM-DD)
          if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return format(date, 'PPP'); // Format Date only (e.g., October 10th, 2023)
          }
          return format(date, 'PPp'); // Format Date and Time
      } catch {
          return String(dateInput); // Fallback
      }
   };

  // Render specific details based on item type
  const renderItemDetails = (item: ScheduledItem) => {
    switch (item.type) {
      case 'email':
        return (
          <>
            <p><strong>To:</strong> {item.details.to}</p>
            <p><strong>Subject:</strong> {item.details.subject}</p>
            {item.details.scheduledTime && <p><strong>Scheduled:</strong> {formatDate(item.details.scheduledTime)}</p>}
             <p><strong>Status:</strong> <span className={`capitalize font-medium ${item.status === 'failed' ? 'text-destructive' : 'text-green-600'}`}>{item.status}</span></p>
          </>
        );
      case 'meeting':
        return (
          <>
            <p><strong>Title:</strong> {item.details.title}</p>
            <p><strong>Attendees:</strong> {item.details.attendees.join(', ')}</p>
            <p><strong>Time:</strong> {formatDate(item.details.startTime)} - {formatDate(item.details.endTime)}</p>
            {item.details.location && <p><strong>Location:</strong> {item.details.location}</p>}
             <p><strong>Status:</strong> <span className={`capitalize font-medium ${item.status === 'failed' ? 'text-destructive' : 'text-green-600'}`}>{item.status}</span></p>
          </>
        );
      case 'hotel':
        return (
          <>
            <p><strong>Hotel:</strong> {item.details.hotelName}</p>
            <p><strong>Confirmation:</strong> {item.details.confirmationNumber}</p>
            <p><strong>Dates:</strong> {formatDate(item.details.checkInDate)} - {formatDate(item.details.checkOutDate)}</p>
             <p><strong>Status:</strong> <span className={`capitalize font-medium ${item.status === 'confirmed' ? 'text-green-600' : 'text-muted-foreground'}`}>{item.status}</span></p>
          </>
        );
      case 'flight':
        return (
          <>
            <p><strong>Flight:</strong> {item.details.flightNumber} ({item.details.departureAirport} to {item.details.arrivalAirport})</p>
            <p><strong>Time:</strong> Departs {formatDate(item.details.departureTime)}, Arrives {formatDate(item.details.arrivalTime)}</p>
            {item.details.confirmationMessage && <p><strong>Confirmation:</strong> {item.details.confirmationMessage}</p>}
             <p><strong>Status:</strong> <span className={`capitalize font-medium ${item.status === 'confirmed' ? 'text-green-600' : 'text-muted-foreground'}`}>{item.status}</span></p>
          </>
        );
      default:
        return <p>Unknown task type.</p>;
    }
  };

   // Helper to get icon based on type
   const getItemIcon = (type: ScheduledItem['type']) => {
     switch (type) {
       case 'email': return <Mail className="h-5 w-5 text-primary" />;
       case 'meeting': return <Calendar className="h-5 w-5 text-primary" />;
       case 'hotel': return <Hotel className="h-5 w-5 text-primary" />;
       case 'flight': return <Plane className="h-5 w-5 text-primary" />;
       default: return <AlertCircle className="h-5 w-5 text-muted-foreground" />;
     }
   };


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
           {isLoading ? (
             <div className="text-center py-12">
               <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
               <p className="mt-2 text-muted-foreground">Loading tasks...</p>
             </div>
           ) : error ? (
             <div className="text-center text-destructive py-12">
                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
               <p>{error}</p>
             </div>
           ) : upcomingItems.length === 0 ? (
             <div className="text-center text-muted-foreground py-12">
               <p>No upcoming tasks or bookings found.</p>
               <p className="mt-2">Use the quick actions above to get started!</p>
             </div>
           ) : (
              <ul className="space-y-4">
                 {upcomingItems.map((item) => (
                   <li key={item.id} className="p-4 border rounded-md bg-card flex items-start gap-4 shadow-sm">
                     <div className="pt-1">
                        {getItemIcon(item.type)}
                     </div>
                     <div className="flex-1 text-sm space-y-1">
                       {renderItemDetails(item)}
                       <p className="text-xs text-muted-foreground">Created: {formatDate(item.createdAt)}</p>
                     </div>
                      {/* Optional: Add action buttons like 'Cancel' or 'View Details' */}
                      {/* <Button variant="ghost" size="sm">View</Button> */}
                   </li>
                 ))}
               </ul>
           )}
         </CardContent>
       </Card>
    </div>
  );
}
