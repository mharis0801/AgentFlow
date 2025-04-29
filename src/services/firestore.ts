import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc, Timestamp } from "firebase/firestore";

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: any; // Use 'any' for FieldValue or handle serverTimestamp correctly
  updatedAt?: any; // Optional: Track updates
}

/**
 * Adds or updates user data in Firestore.
 * Creates the document if it doesn't exist based on the UID.
 * Updates the updatedAt timestamp on every upsert.
 * @param user The user object from Firebase Auth or a plain object with user details.
 */
export const upsertUser = async (user: { uid: string; email: string | null; displayName: string | null }): Promise<void> => {
  const userRef = doc(db, "users", user.uid);

  const userData: Partial<UserData> = { // Use Partial to allow merging
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User', // Provide a default display name
    updatedAt: serverTimestamp(), // Update timestamp on every upsert
  };

  try {
    // Use setDoc with merge: true to create or update
    // Also set createdAt only if the document is being created (merge won't overwrite if it exists)
    await setDoc(userRef, {
       ...userData,
       createdAt: serverTimestamp(), // Set createdAt on initial creation
    }, { merge: true }); // Merge ensures we don't overwrite existing fields unnecessarily
    console.log("User data upserted successfully for UID:", user.uid);
  } catch (error) {
    console.error("Error upserting user data:", error);
    throw new Error("Could not save user data to database.");
  }
};

/**
 * Retrieves user data from Firestore.
 * @param uid The user's unique ID.
 * @returns The user data object or null if not found.
 */
export const getUserData = async (uid: string): Promise<UserData | null> => {
  const userRef = doc(db, "users", uid);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      // Ensure Timestamps are handled correctly if needed downstream
      const data = docSnap.data();
      return {
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined, // Example conversion
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
      } as UserData;
    } else {
      console.log("No such user document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting user data:", error);
    throw new Error("Could not retrieve user data.");
  }
};


// --- Agent Task Management ---

type TaskType = 'email' | 'meeting' | 'hotel' | 'flight';
type TaskStatus = 'pending' | 'scheduled' | 'confirmed' | 'failed' | 'completed';

interface AgentTaskPayload {
  userId: string; // UID of the user who requested the task
  type: TaskType;
  prompt?: string; // Original prompt (optional, for reference)
  details: Record<string, any>; // Specific details based on type (e.g., { to, subject, body } for email)
  status: TaskStatus;
  createdAt?: Timestamp; // Handled by serverTimestamp
  result?: Record<string, any> | null; // Store confirmation details or error info
  error?: string | null; // Store error message if failed
}

/**
 * Saves an agent task to Firestore.
 * @param taskData The task data payload.
 * @returns The ID of the newly created task document.
 */
export const saveAgentTask = async (taskData: Omit<AgentTaskPayload, 'createdAt'>): Promise<string> => {
    // Ensure dates within details are Firestore Timestamps if they represent specific times
    // (Example: Convert JS Date objects to Timestamps before saving)
    // if (taskData.type === 'meeting' && taskData.details.startTime instanceof Date) {
    //   taskData.details.startTime = Timestamp.fromDate(taskData.details.startTime);
    // }
    // if (taskData.type === 'meeting' && taskData.details.endTime instanceof Date) {
    //    taskData.details.endTime = Timestamp.fromDate(taskData.details.endTime);
    // }
     // Dates for hotel/flight are strings (YYYY-MM-DD), no conversion needed unless storing as Timestamps

  const taskPayloadWithTimestamp: AgentTaskPayload = {
    ...taskData,
    createdAt: serverTimestamp() as Timestamp, // Add server timestamp
    result: taskData.result || null,
    error: taskData.error || null,
  };

  try {
    // Add a new document with an auto-generated ID to the "agentTasks" collection
    const docRef = await addDoc(collection(db, "agentTasks"), taskPayloadWithTimestamp);
    console.log("Agent task saved successfully with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error saving agent task:", error);
    throw new Error("Could not save agent task to database.");
  }
};

/**
 * Updates the status or result of an existing agent task.
 * @param taskId The ID of the task document to update.
 * @param updates An object containing the fields to update (e.g., { status: 'confirmed', result: {...} }).
 */
export const updateAgentTask = async (taskId: string, updates: Partial<Pick<AgentTaskPayload, 'status' | 'result' | 'error'>>): Promise<void> => {
    const taskRef = doc(db, "agentTasks", taskId);
    try {
        await setDoc(taskRef, {
            ...updates,
            updatedAt: serverTimestamp() // Add/update an 'updatedAt' field
        }, { merge: true });
        console.log(`Agent task ${taskId} updated successfully.`);
    } catch (error) {
        console.error(`Error updating agent task ${taskId}:`, error);
        throw new Error("Could not update agent task.");
    }
};
