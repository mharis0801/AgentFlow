

// Form-based flows (primary interaction method now)
import '@/ai/flows/search-hotels.ts';
import '@/ai/flows/setup-meeting-from-prompt.ts'; // Still used for form-based meeting setup
import '@/ai/flows/search-flights.ts';
import '@/ai/flows/schedule-email.ts';

// Import tools so they are registered with Genkit
// These are now used by the form-based flows directly, not via LLM tool calling
import '@/ai/tools/email-reader'; // Might be used for future features (e.g., proactive tasks)
import '@/ai/tools/send-email';
