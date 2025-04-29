
// import '@/ai/flows/schedule-email-from-prompt.ts'; // Removed as replaced by form-based flow
import '@/ai/flows/book-hotel-reservation-from-prompt.ts'; // Will be renamed or refactored
import '@/ai/flows/setup-meeting-from-prompt.ts'; // Will be renamed or refactored
import '@/ai/flows/find-and-book-flights.ts'; // Will be renamed or refactored
import '@/ai/flows/schedule-email.ts'; // Add new flow for form-based email

// Import tools so they are registered with Genkit
import '@/ai/tools/email-reader';
import '@/ai/tools/send-email';
