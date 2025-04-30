
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
  // Expanded status to cover search states better
  status: 'pending' | 'processing' | 'scheduled' | 'confirmed' | 'failed' | 'completed' | 'sent' | 'search_complete' | 'search_failed' | string;
  details: Record<string, any>; // Flexible details object
  result?: Record<string, any> | null; // Optional result object
  error?: string | null; // Optional error message
}

interface ScheduledEmail extends ScheduledItemBase {
  type: 'email';
  details: {
    to: string;
    subject: string;
    body?: string; // Body might not always be stored
  };
  result?: {
    messageId?: string;
  } | null;
  status: 'pending' | 'sent' | 'failed'; // Specific statuses for email
}

interface ScheduledMeeting extends ScheduledItemBase {
  type: 'meeting';
  details: {
    title: string;
    attendees: string[];
    startTime: Timestamp; // Assume stored as Timestamp
    endTime: Timestamp;   // Assume stored as Timestamp
    location?: string;
    agenda?: string;
  };
   result?: {
     inviteSent?: boolean;
     messageId?: string;
   } | null;
   status: 'pending' | 'scheduled' | 'confirmed' | 'failed'; // Specific statuses for meeting
}

// Interface for Hotel Search Task
interface HotelSearchTask extends ScheduledItemBase {
  type: 'hotel';
  details: {
    searchCriteria: { // Store the original search criteria
        city: string;
        checkInDate: string; // Store as string YYYY-MM-DD
        checkOutDate: string; // Store as string YYYY-MM-DD
        numberOfGuests: number;
    };
  };
   result?: {
     resultsFound?: number; // Store how many hotels were found
   } | null;
   // Status reflects the search operation itself
   status: 'pending' | 'completed' | 'failed';
}

// Interface for Flight Search Task
interface FlightSearchTask extends ScheduledItemBase {
  type: 'flight';
  details: {
     searchCriteria: { // Store the original search criteria
        departureCity: string;
        arrivalCity: string;
        departureDate: string; // Store as string YYYY-MM-DD
        numberOfPassengers: number;
    };
  };
   result?: {
     resultsFound?: number; // Store how many flights were found
   } | null;
   // Status reflects the search operation itself
   status: 'pending' | 'completed' | 'failed';
}

// Union type includes the new search task types
type ScheduledItem = ScheduledEmail | ScheduledMeeting | HotelSearchTask | FlightSearchTask;


export default function DashboardPage() {
  const { user } = useAuth();
  const [upcomingItems, setUpcomingItems] = useState<ScheduledItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const quickActions = [
    { href: "/schedule-email", label: "Send Email", icon: Mail }, // Changed label
    { href: "/setup-meeting", label: "Setup Meeting", icon: Calendar },
    { href: "/book-hotel", label: "Search Hotels", icon: Hotel }, // Keep label as Search
    { href: "/book-flight", label: "Search Flights", icon: Plane }, // Keep label as Search
  ];

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      setUpcomingItems([]); // Clear items if user logs out
      return; // No user, no data to fetch
    }

    setIsLoading(true);
    setError(null);

    const tasksCollectionRef = collection(db, "agentTasks");
    const q = query(
      tasksCollectionRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc") // Show newest tasks first
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const items: ScheduledItem[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as DocumentData;
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(); // Fallback

         // Basic validation for core fields
         if (!data.type || !data.details) {
           console.warn(`Skipping task ${doc.id}: Missing type or details.`);
           return;
         }

        items.push({
          id: doc.id,
          ...data,
          createdAt: createdAt,
        } as ScheduledItem);
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
   const formatDate = (dateInput: Timestamp | string | undefined | Date, formatType: 'date' | 'dateTime' = 'dateTime'): string => {
      if (!dateInput) return 'N/A';
      try {
          let date: Date;
          if (dateInput instanceof Timestamp) {
              date = dateInput.toDate();
          } else if (dateInput instanceof Date) {
              date = dateInput;
          } else {
              date = new Date(dateInput); // Try parsing string (ISO, YYYY-MM-DD)
          }

          if (isNaN(date.getTime())) return String(dateInput); // Return original if invalid

          if (formatType === 'date') {
              // Check if it looks like just a date string (YYYY-MM-DD) and parse as UTC
              if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
                   // Add time part to ensure it's parsed as local time zone, then format
                    date = new Date(dateInput + 'T00:00:00');
                    if (isNaN(date.getTime())) return String(dateInput); // Fallback if parsing failed
                    return format(date, 'PPP'); // Format Date only (e.g., October 10th, 2023)
              }
               return format(date, 'PPP'); // Format Date only (e.g., October 10th, 2023)
          }
          // Default to dateTime format
          return format(date, 'PPp'); // Format Date and Time (e.g., Oct 10, 2023, 9:00:00 AM)
      } catch(e) {
          console.error("Error formatting date:", dateInput, e);
          return String(dateInput); // Fallback
      }
   };

    // Helper to get status color
    const getStatusColor = (status: ScheduledItem['status']): string => {
        switch (status?.toLowerCase()) {
            case 'confirmed':
            case 'completed':
            case 'sent':
            case 'search_complete': // Added status for successful search
                return 'text-green-600';
            case 'failed':
            case 'search_failed': // Added status for failed search
                return 'text-destructive';
            case 'pending':
            case 'processing':
                 return 'text-yellow-600';
            case 'scheduled':
                 return 'text-blue-600';
            default:
                return 'text-muted-foreground';
        }
    };

   // Helper to get display text for status
   const getStatusText = (status: ScheduledItem['status']): string => {
        if (!status) return 'Unknown';
        // Replace underscores and capitalize
        return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
   };


  // Render specific details based on item type
  const renderItemDetails = (item: ScheduledItem) => {
    const statusColor = getStatusColor(item.status);
    const statusText = getStatusText(item.status);

    switch (item.type) {
      case 'email':
        const emailItem = item as ScheduledEmail;
        return (
          <>
            <p><strong>To:</strong> {emailItem.details.to || 'N/A'}</p>
            <p><strong>Subject:</strong> {emailItem.details.subject || 'N/A'}</p>
            <p><strong>Status:</strong> <span className={`font-medium ${statusColor}`}>{statusText}</span></p>
             {item.status === 'failed' && item.error && <p className="text-xs text-destructive"><strong>Error:</strong> {item.error}</p>}
             {item.status === 'sent' && item.result?.messageId && <p className="text-xs text-muted-foreground">Msg ID: {item.result.messageId}</p>}
          </>
        );
      case 'meeting':
         const meetingItem = item as ScheduledMeeting;
        return (
          <>
            <p><strong>Title:</strong> {meetingItem.details.title || 'N/A'}</p>
            <p><strong>Attendees:</strong> {(meetingItem.details.attendees || []).join(', ')}</p>
            <p><strong>Time:</strong> {formatDate(meetingItem.details.startTime)} - {formatDate(meetingItem.details.endTime)}</p>
            {meetingItem.details.location && <p><strong>Location:</strong> {meetingItem.details.location}</p>}
             <p><strong>Status:</strong> <span className={`font-medium ${statusColor}`}>{statusText}</span> {item.result?.inviteSent ? '(Invite Sent)' : item.status === 'confirmed' ? '(Invite Send Failed)' : ''}</p>
             {item.status === 'failed' && item.error && <p className="text-xs text-destructive"><strong>Error:</strong> {item.error}</p>}
          </>
        );
      case 'hotel':
         const hotelTask = item as HotelSearchTask;
         const criteria = hotelTask.details.searchCriteria;
        return (
          <>
            <p><strong>Search Request:</strong> Hotel in {criteria?.city || 'N/A'}</p>
            <p><strong>Dates:</strong> {formatDate(criteria?.checkInDate, 'date')} - {formatDate(criteria?.checkOutDate, 'date')}</p>
            <p><strong>Guests:</strong> {criteria?.numberOfGuests || 'N/A'}</p>
            <p><strong>Status:</strong> <span className={`font-medium ${statusColor}`}>{statusText}</span> {item.result?.resultsFound !== undefined ? `(${item.result.resultsFound} found)` : ''}</p>
            {item.status === 'failed' && item.error && <p className="text-xs text-destructive"><strong>Error:</strong> {item.error}</p>}
             {/* Link to the search page with pre-filled criteria could be added here */}
             <Link href={`/book-hotel?city=${encodeURIComponent(criteria?.city || '')}&checkIn=${criteria?.checkInDate || ''}&checkOut=${criteria?.checkOutDate || ''}&guests=${criteria?.numberOfGuests || ''}`}>
                 <Button variant="link" size="sm" className="p-0 h-auto text-xs">Repeat Search</Button>
             </Link>
          </>
        );
     case 'flight':
         const flightTask = item as FlightSearchTask;
         const flightCriteria = flightTask.details.searchCriteria;
        return (
          <>
            <p><strong>Search Request:</strong> Flight from {flightCriteria?.departureCity || 'N/A'} to {flightCriteria?.arrivalCity || 'N/A'}</p>
            <p><strong>Date:</strong> {formatDate(flightCriteria?.departureDate, 'date')}</p>
            <p><strong>Passengers:</strong> {flightCriteria?.numberOfPassengers || 'N/A'}</p>
            <p><strong>Status:</strong> <span className={`font-medium ${statusColor}`}>{statusText}</span> {item.result?.resultsFound !== undefined ? `(${item.result.resultsFound} found)` : ''}</p>
             {item.status === 'failed' && item.error && <p className="text-xs text-destructive"><strong>Error:</strong> {item.error}</p>}
              {/* Link to the search page with pre-filled criteria could be added here */}
              <Link href={`/book-flight?from=${encodeURIComponent(flightCriteria?.departureCity || '')}&to=${encodeURIComponent(flightCriteria?.arrivalCity || '')}&date=${flightCriteria?.departureDate || ''}&pax=${flightCriteria?.numberOfPassengers || ''}`}>
                  <Button variant="link" size="sm" className="p-0 h-auto text-xs">Repeat Search</Button>
              </Link>
          </>
        );
      default:
         // Attempt to render basic details if type is unknown but data exists
         const itemData = item as any; // Cast to any for generic access
         return (
           <>
             <p><strong>Task Type:</strong> {itemData.type || 'Unknown'}</p>
             <p><strong>Details:</strong> {JSON.stringify(itemData.details)}</p>
             <p><strong>Status:</strong> <span className={`font-medium ${statusColor}`}>{statusText}</span></p>
              {item.status === 'failed' && item.error && <p className="text-xs text-destructive"><strong>Error:</strong> {item.error}</p>}
           </>
         );
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
       <h1 className="text-3xl font-bold mb-1 text-foreground">Welcome, {user?.displayName || user?.email || 'User'}!</h1>
       <p className="text-muted-foreground mb-6">Manage your tasks and searches.</p>

      <Card className="mb-8 shadow-md">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Start a new task or search.</CardDescription>
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
           <CardTitle>Task History</CardTitle>
           <CardDescription>View your processed tasks and search history.</CardDescription>
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
               <p>No tasks or searches found.</p>
               <p className="mt-2">Use the quick actions above to get started!</p>
             </div>
           ) : (
              <ul className="space-y-4">
                 {upcomingItems.map((item) => (
                   <li key={item.id} className="p-4 border rounded-md bg-card flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow duration-200">
                     <div className="pt-1">
                        {getItemIcon(item.type)}
                     </div>
                     <div className="flex-1 text-sm space-y-1">
                       {renderItemDetails(item)}
                       <p className="text-xs text-muted-foreground">Created: {formatDate(item.createdAt)} (ID: {item.id.substring(0,8)}...)</p>
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
