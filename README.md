# AgentFlow

This is a Next.js web application built with Firebase and Genkit, designed to act as an AI-powered daily assistant.

## Features

-   **Email Scheduling**: AI analyzes requests and schedules emails.
-   **Meeting Setup**: AI automates meeting scheduling based on user preferences.
-   **Hotel Reservations**: AI assists in booking hotel stays.
-   **Flight Booking**: AI helps find and book flights.
-   **Dashboard**: Manage scheduled tasks and view confirmations.
-   **Authentication**: Secure account creation and Google Sign-In.

## Getting Started

### Prerequisites

-   Node.js (v18 or later recommended)
-   npm or yarn
-   A Firebase project
-   A Google Cloud project with the Gemini API enabled

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

    Create a `.env` file in the root of the project and add your Firebase project configuration and Google Generative AI API key. You can find these details in your Firebase project settings and Google Cloud console.

    ```dotenv
    # Firebase Configuration - Replace with your actual project credentials
    NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="YOUR_AUTH_DOMAIN"
    NEXT_PUBLIC_FIREBASE_PROJECT_ID="YOUR_PROJECT_ID"
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="YOUR_STORAGE_BUCKET"
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
    NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="YOUR_MEASUREMENT_ID"

    # Google Generative AI API Key - Replace with your actual key
    GOOGLE_GENAI_API_KEY="YOUR_GOOGLE_GENAI_API_KEY"
    ```

    **Important:** Ensure your Firebase project has Authentication enabled (Email/Password and Google providers) and Firestore initialized. Also, ensure the Gemini API is enabled in your Google Cloud project and the API key has the necessary permissions.

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

## Project Structure

-   `src/app`: Next.js App Router pages and layouts.
    -   `(app)`: Authenticated application routes.
    -   `signin`: Sign-in page.
    -   `signup`: Sign-up page.
-   `src/ai`: Genkit AI flows, tools, and configuration.
    -   `flows`: Defines the core AI logic for each feature.
    -   `tools`: Defines tools the AI can use (e.g., sending emails).
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
-   `src/services`: Backend service interactions (e.g., Firestore, mock booking APIs).
-   `public`: Static assets.
-   `styles`: Global CSS and Tailwind configuration.

## Contributing

Contributions are welcome! Please follow standard Git workflow (fork, branch, pull request).

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
