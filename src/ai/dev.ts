

// import '@/ai/flows/schedule-email-from-prompt.ts'; // Removed as replaced by form-based flow
import '@/ai/flows/search-hotels.ts'; // Renamed from book-hotel...
import '@/ai/flows/setup-meeting-from-prompt.ts'; // Still using this for meeting setup
import '@/ai/flows/search-flights.ts'; // Renamed from find-and-book...
import '@/ai/flows/schedule-email.ts'; // Add new flow for form-based email

// Import tools so they are registered with Genkit
import '@/ai/tools/email-reader';
import '@/ai/tools/send-email';

