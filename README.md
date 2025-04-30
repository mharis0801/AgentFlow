# AgentFlow

This is a Next.js web application built with Firebase and Genkit, designed to act as an AI-powered daily assistant using structured forms and real-time APIs.

## Features

-   **Email Sending**: Send emails via a form, using Nodemailer/Gmail.
-   **Meeting Setup**: Schedule meetings via a form, sending simulated invites via email.
-   **Hotel Search**: Search for real-time hotel availability using the Amadeus API.
-   **Flight Search**: Search for real-time flight availability using the Amadeus API.
-   **Dashboard**: Manage task history and view confirmations/search results.
-   **Authentication**: Secure account creation and Google Sign-In via Firebase Auth.

## Getting Started

### Prerequisites

-   Node.js (v18 or later recommended)
-   npm or yarn
-   A Firebase project (with Firestore and Authentication enabled)
-   A Google Cloud project (associated with Firebase)
-   **Amadeus for Developers Account**: Required for real-time flight and hotel search. Sign up at [https://developers.amadeus.com/](https://developers.amadeus.com/).
-   **Gmail Account with App Password**: Required for sending/reading emails via the agent.
    -   Enable IMAP in your Gmail settings ([how-to](https://support.google.com/mail/answer/7126229?hl=en)).
    -   Generate an App Password ([how-to](https://support.google.com/accounts/answer/185833?hl=en)). **Do not use your main Gmail password.**

### Setup

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd agentflow
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Set up Environment Variables:**

    Create a `.env` file in the root of the project and add your configurations:

    ```dotenv
    # Firebase Configuration - Replace with your actual project credentials
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID" # Optional

    # Google Generative AI API Key (Still needed for Genkit setup)
    GOOGLE_GENAI_API_KEY="YOUR_GOOGLE_GENAI_API_KEY"

    # Amadeus API Credentials (Get from Amadeus for Developers dashboard)
    AMADEUS_API_KEY="YOUR_AMADEUS_API_KEY"
    AMADEUS_API_SECRET="YOUR_AMADEUS_API_SECRET"

    # Gmail Credentials for Agent Emailing (Use an App Password)
    GMAIL_EMAIL="your_agent_email@gmail.com"
    GMAIL_APP_PASSWORD="your_gmail_app_password"
    ```

    **Important:**
    - Ensure your Firebase project has Authentication enabled (Email/Password and Google providers) and Firestore initialized with appropriate security rules (see Firebase setup guides).
    - Get your Amadeus API Key and Secret from the Amadeus for Developers dashboard after creating an application. Start with their Test environment.
    - Generate a **Gmail App Password** for `GMAIL_APP_PASSWORD`. **Do not use your main password.** Ensure IMAP is enabled in the Gmail account settings.

4.  **Run the development server:**

    You need two terminals for development: one for the Next.js app and one for the Genkit development server.

    *   **Terminal 1 (Next.js):**
        ```bash
        npm run dev
        # or
        yarn dev
        ```
        This will start the Next.js frontend, usually on `http://localhost:9002`.

    *   **Terminal 2 (Genkit):**
        ```bash
        npm run genkit:watch
        # or
        yarn genkit:watch
        ```
        This starts the Genkit development server, which handles the AI flows. It typically runs on `http://localhost:4000` and provides a UI for inspecting flows.

5.  **Open the application:**
    Open [http://localhost:9002](http://localhost:9002) in your browser.

### Building for Production

```bash
npm run build
npm run start
# or
yarn build
yarn start
```
**(Remember to switch Amadeus API credentials and hostname to production if deploying)**

## Project Structure

-   `src/app`: Next.js App Router pages and layouts.
    -   `(app)`: Authenticated application routes (Dashboard, forms).
    -   `signin`: Sign-in page.
    -   `signup`: Sign-up page.
-   `src/ai`: Genkit AI flows and configuration.
    -   `flows`: Defines the logic connecting forms to services/tools.
    -   `tools`: Defines tools like sending/reading emails.
    -   `ai-instance.ts`: Genkit initialization.
    -   `dev.ts`: Entry point for the Genkit development server.
-   `src/components`: Reusable UI components (using ShadCN UI).
    -   `layout`: Layout components like Header, Sidebar.
    -   `ui`: Base ShadCN UI components.
-   `src/contexts`: React context providers (e.g., AuthContext).
-   `src/hooks`: Custom React hooks (e.g., useToast, useMobile).
-   `src/lib`: Utility functions and library initializations.
    -   `firebase`: Firebase initialization.
    -   `utils.ts`: General utility functions.
-   `src/services`: Backend service interactions.
    -   `firestore.ts`: Firestore data operations.
    -   `flight-booking.ts`: Amadeus flight search integration.
    -   `hotel-booking.ts`: Amadeus hotel search integration.
    -   `location-service.ts`: IATA code lookup service.
-   `public`: Static assets.
-   `styles`: Global CSS and Tailwind configuration.

## API Integrations

-   **Amadeus API**: Used for searching real-time flight and hotel availability. Requires an Amadeus for Developers account and API keys.
-   **Nodemailer (with Gmail)**: Used for sending emails from the agent's account. Requires a Gmail account with IMAP enabled and an App Password.
-   **IMAP (via `imap` library)**: Used for reading emails in the agent's inbox. Requires the same Gmail credentials as Nodemailer.

## Contributing

Contributions are welcome! Please follow standard Git workflow (fork, branch, pull request).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
