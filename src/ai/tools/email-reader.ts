
'use server';
/**
 * @fileOverview Defines a Genkit tool for reading unread emails using IMAP with Gmail.
 * Requires environment variables: GMAIL_EMAIL, GMAIL_APP_PASSWORD.
 * Requires IMAP to be enabled in the target Gmail account settings.
 * @see https://support.google.com/mail/answer/7126229?hl=en for enabling IMAP.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { inspect } from 'util'; // For debugging complex objects

// Define a simplified email structure for the tool's output
const EmailSchema = z.object({
  id: z.string().describe('A unique identifier for the email (UID).'),
  from: z.string().describe('The sender\'s address (e.g., "Sender Name <sender@example.com>").'),
  subject: z.string().describe('The subject line of the email.'),
  body: z.string().describe('The plain text content/body of the email.'),
  receivedAt: z.string().datetime().describe('The time the email was received (ISO format).'),
  // read: z.boolean().describe('Whether the email has been marked as read.'), // We fetch unread, so this is implicitly false
});

// Ensure environment variables are set
if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    console.warn(`
        ****************************************************
        * WARNING: GMAIL_EMAIL or GMAIL_APP_PASSWORD       *
        * environment variables not set.                   *
        * Email reading will fail.                         *
        * Please set them in your .env file.               *
        * Requires IMAP enabled in Gmail settings.         *
        ****************************************************
    `);
}

const imapConfig: Imap.Config = {
    user: process.env.GMAIL_EMAIL!,
    password: process.env.GMAIL_APP_PASSWORD!,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false } // Adjust as needed for your environment
};


// Helper function to connect and search IMAP
function fetchUnreadEmails(maxEmails: number): Promise<z.infer<typeof EmailSchema>[]> {
     if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
        console.error("IMAP connection skipped: Missing Gmail credentials in environment.");
        return Promise.resolve([]); // Return empty if no credentials
     }

    return new Promise((resolve, reject) => {
        const imap = new Imap(imapConfig);
        const emails: z.infer<typeof EmailSchema>[] = [];

        function openInbox(cb: (err: Error | null, box?: Imap.Box) => void) {
            imap.openBox('INBOX', false, cb); // false = readOnly is false (we might want to mark as read later)
        }

        imap.once('ready', () => {
            console.log('IMAP connection ready. Opening INBOX...');
            openInbox((err, box) => {
                if (err) {
                    console.error('Error opening INBOX:', err);
                    imap.end();
                    return reject(new Error(`Failed to open INBOX: ${err.message}`));
                }
                if (!box) {
                    imap.end();
                    return reject(new Error('INBOX could not be opened (box is null).'));
                }
                console.log('INBOX opened. Searching for unread messages...');
                // Search for unread messages
                imap.search(['UNSEEN'], (searchErr, results) => {
                    if (searchErr) {
                        console.error('Error searching for unread emails:', searchErr);
                        imap.end();
                        return reject(new Error(`Failed to search emails: ${searchErr.message}`));
                    }

                    if (!results || results.length === 0) {
                        console.log('No unread messages found.');
                        imap.end();
                        return resolve([]);
                    }

                    console.log(`Found ${results.length} unread messages. Fetching details for max ${maxEmails}...`);
                    // Fetch the most recent 'maxEmails' UIDs
                    const uidsToFetch = results.slice(-maxEmails);

                    if (uidsToFetch.length === 0) {
                        imap.end();
                        return resolve([]);
                    }

                    const f = imap.fetch(uidsToFetch, { bodies: '', markSeen: false }); // Fetch full message, don't mark as read yet

                    f.on('message', (msg, seqno) => {
                         console.log('Processing message #%d', seqno);
                         let messageData = '';
                         let attributes: Imap.ImapMessageAttributes | null = null;

                         msg.on('body', (stream, info) => {
                            stream.on('data', (chunk) => {
                                messageData += chunk.toString('utf8');
                            });
                         });
                         msg.once('attributes', (attrs) => {
                            attributes = attrs;
                            console.log(`Attributes for message #%d: UID=${attrs.uid}, Date=${attrs.date}`);
                         });
                         msg.once('end', () => {
                             console.log('Finished receiving message #%d', seqno);
                             if (attributes && messageData) {
                                 simpleParser(messageData, (parseErr, parsed) => {
                                     if (parseErr) {
                                         console.error(`Error parsing email UID ${attributes?.uid}:`, parseErr);
                                         // Continue processing other emails
                                     } else if (attributes) {
                                         emails.push({
                                             id: attributes.uid.toString(), // Use UID as the stable ID
                                             from: parsed.from?.text || 'Unknown Sender',
                                             subject: parsed.subject || '(No Subject)',
                                             body: parsed.text || '(No Body Content)', // Prefer plain text body
                                             receivedAt: attributes.date.toISOString(),
                                         });
                                          console.log(`Successfully parsed email UID ${attributes.uid}`);
                                     }
                                 });
                             } else {
                                 console.warn(`Missing attributes or data for message #${seqno}`);
                             }
                         });
                    });

                    f.once('error', (fetchErr) => {
                        console.error('Fetch error:', fetchErr);
                         // Don't reject immediately, try to resolve with what was fetched
                         // reject(new Error(`Failed to fetch email details: ${fetchErr.message}`));
                    });

                    f.once('end', () => {
                        console.log('Finished fetching all messages.');
                        imap.end();
                        resolve(emails.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())); // Sort newest first
                    });
                });
            });
        });

        imap.once('error', (err) => {
            console.error('IMAP connection error:', err);
             // Handle specific auth errors
            if (err.message.includes('Invalid credentials') || err.message.includes('Log in')) {
                reject(new Error('IMAP authentication failed. Check GMAIL_EMAIL and GMAIL_APP_PASSWORD, and ensure IMAP is enabled with App Password access.'));
            } else {
                reject(new Error(`IMAP connection error: ${err.message}`));
            }
        });

        imap.once('end', () => {
            console.log('IMAP connection ended.');
        });

        console.log('Attempting IMAP connection...');
        imap.connect();
    });
}

// TODO: Function to mark an email as read by UID (implement if needed after processing)
// async function markEmailAsRead(uid: string): Promise<void> { ... }

export const readEmailsTool = ai.defineTool(
  {
    name: 'readEmails',
    description: 'Reads recent unread emails from the dedicated assistant inbox via IMAP. Use this to check for new requests or information relevant to scheduling tasks. Returns a list of emails, most recent first.',
    inputSchema: z.object({
      maxEmails: z.number().int().positive().optional().default(5).describe('The maximum number of unread emails to retrieve.'),
    }),
    outputSchema: z.array(EmailSchema).describe('An array of retrieved unread email objects.'),
  },
  async (input) => {
    console.log(`Reading up to ${input.maxEmails} unread emails via IMAP...`);

    try {
        const unreadEmails = await fetchUnreadEmails(input.maxEmails);
        console.log(`Successfully fetched ${unreadEmails.length} unread emails.`);
        // In a real scenario, after processing these emails (e.g., creating tasks),
        // you would call another function/tool to mark them as read using their UIDs.
        // Example: for (const email of unreadEmails) { await markEmailAsRead(email.id); }
        return unreadEmails;
    } catch (error: any) {
        console.error("Error in readEmailsTool:", error);
        // Return empty array or rethrow, depending on desired behavior
        // Rethrowing makes the failure explicit to the calling flow
        throw new Error(`Failed to read emails: ${error.message}`);
         // return []; // Alternatively, return empty on failure
    }
  }
);

// Note: Marking emails as read is crucial to avoid reprocessing. This needs
// to be implemented as a separate step or tool to be called *after* an email
// has been successfully processed by an agent flow.
