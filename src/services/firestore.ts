
import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: Timestamp; // Should be Timestamp after retrieval
  updatedAt?: Timestamp; // Should be Timestamp after retrieval
}

/**
 * Adds or updates user data in Firestore.
 * Creates the document if it doesn't exist based on the UID.
 * Updates the updatedAt timestamp on every upsert.
 * @param user The user object from Firebase Auth or a plain object with user details.
 */
export const upsertUser = async (user: { uid: string; email: string | null; displayName: string | null }): Promise<void> => {
  const userRef = doc(db, "users", user.uid);

  const userData: Partial<Omit<UserData, 'createdAt' | 'updatedAt'>> & { updatedAt: any, createdAt?: any } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User', // Provide a default display name
    updatedAt: serverTimestamp(), // Update timestamp on every upsert
  };

  try {
    // Check if the document exists to conditionally add createdAt
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
        userData.createdAt = serverTimestamp(); // Add createdAt only if creating
    }

    // Use setDoc with merge: true to create or update
    await setDoc(userRef, userData, { merge: true });
    console.log("User data upserted successfully for UID:", user.uid);
  } catch (error) {
    console.error("Error upserting user data for UID:", user.uid, error); // Log UID with error
    // Provide a more specific error message if possible, otherwise generic
    const errorMessage = error instanceof Error ? error.message : 'Unknown error saving user data.';
    throw new Error(`Could not save user data to database: ${errorMessage}`);
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
      const data = docSnap.data();
      // Convert server timestamps to Firestore Timestamp objects for type consistency
      return {
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt : Timestamp.now(), // Ensure it's a Timestamp
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.now(), // Ensure it's a Timestamp
      } as UserData;
    } else {
      console.log("No such user document for UID:", uid);
      return null;
    }
  } catch (error) {
    console.error("Error getting user data for UID:", uid, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error retrieving user data.';
    throw new Error(`Could not retrieve user data: ${errorMessage}`);
  }
};


// --- Agent Task Management ---

export type TaskType = 'email' | 'meeting' | 'hotel' | 'flight';
// Added 'sent' status for emails
export type TaskStatus = 'pending' | 'processing' | 'scheduled' | 'confirmed' | 'failed' | 'completed' | 'sent';

export interface AgentTaskPayload {
  userId: string; // UID of the user who requested the task
  type: TaskType;
  details: Record<string, any>; // Specific details based on type
  status: TaskStatus;
  createdAt?: Timestamp; // Firestore Timestamp
  updatedAt?: Timestamp; // Firestore Timestamp
  result?: Record<string, any> | null; // Store confirmation details or error info
  error?: string | null; // Store error message if failed
}

/**
 * Saves an agent task to Firestore.
 * @param taskData The task data payload, excluding server-generated timestamps.
 * @returns The ID of the newly created task document.
 */
export const saveAgentTask = async (taskData: Omit<AgentTaskPayload, 'createdAt' | 'updatedAt'>): Promise<string> => {
    // Prepare the final payload, ensuring result and error are explicitly null if undefined
    const taskPayloadWithTimestamp = {
        ...taskData,
        createdAt: serverTimestamp(), // Use serverTimestamp placeholder
        updatedAt: serverTimestamp(), // Use serverTimestamp placeholder
        result: taskData.result !== undefined ? taskData.result : null,
        error: taskData.error !== undefined ? taskData.error : null,
    };

    try {
        const docRef = await addDoc(collection(db, "agentTasks"), taskPayloadWithTimestamp);
        console.log("Agent task saved successfully with ID:", docRef.id);
        return docRef.id;
    } catch (error: any) {
        // Log the full error and the data that failed to save
        console.error("Error saving agent task to Firestore:", error);
        console.error("Task data that failed to save:", JSON.stringify(taskPayloadWithTimestamp, null, 2));

        // Extract a meaningful error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore save error.';
        // Throw a new error that includes the more specific message
        throw new Error(`Could not save agent task to database. Reason: ${errorMessage}`);
    }
};


/**
 * Updates the status or result of an existing agent task.
 * @param taskId The ID of the task document to update.
 * @param updates An object containing the fields to update (e.g., { status: 'confirmed', result: {...}, error: null }).
 */
// Make updates explicitly Partial and ensure only allowed fields are updated
export const updateAgentTask = async (taskId: string, updates: Partial<Pick<AgentTaskPayload, 'status' | 'result' | 'error' | 'details'>>): Promise<void> => {
    if (!taskId) {
        console.error("updateAgentTask called with invalid taskId:", taskId);
        throw new Error("Invalid Task ID provided for update.");
    }
    const taskRef = doc(db, "agentTasks", taskId);

    // Prepare the update payload, ensuring result and error are explicitly handled
    const updatePayload = {
        ...updates,
        updatedAt: serverTimestamp(), // Always update the 'updatedAt' field
        // Explicitly set error to null if status is successful, unless error is being specifically updated
        ...(updates.status && ['confirmed', 'completed', 'sent', 'scheduled'].includes(updates.status) && !updates.error && { error: null }),
        // Explicitly set result to null if status is failed, unless result is being specifically updated
        ...(updates.status === 'failed' && !updates.result && { result: null }),
    };


    try {
        await updateDoc(taskRef, updatePayload);
        console.log(`Agent task ${taskId} updated successfully.`);
    } catch (error: any) {
        console.error(`Error updating agent task ${taskId}:`, error);
        console.error("Update data:", JSON.stringify(updatePayload, null, 2)); // Log the attempted update data
        const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore update error.';
        throw new Error(`Could not update agent task ${taskId}. Reason: ${errorMessage}`);
    }
};

/**
 * Batched update for multiple agent tasks.
 * Useful for operations like marking multiple tasks as read or archived.
 * @param taskIds An array of task document IDs to update.
 * @param updates An object containing the fields to update for all tasks in the batch.
 */
export const batchUpdateAgentTasks = async (taskIds: string[], updates: Partial<Pick<AgentTaskPayload, 'status' | 'result' | 'error' | 'details'>>): Promise<void> => {
    if (!taskIds || taskIds.length === 0) {
        console.warn("batchUpdateAgentTasks called with no task IDs.");
        return;
    }

    const batch = writeBatch(db);
    const updatePayload = {
        ...updates,
        updatedAt: serverTimestamp()
    };

    taskIds.forEach(taskId => {
        if (taskId) {
            const taskRef = doc(db, "agentTasks", taskId);
            batch.update(taskRef, updatePayload);
        } else {
            console.warn("Skipping invalid taskId in batch update:", taskId);
        }
    });

    try {
        await batch.commit();
        console.log(`Batch updated ${taskIds.length} agent tasks successfully.`);
    } catch (error: any) {
        console.error(`Error performing batch update on agent tasks:`, error);
        console.error("Batch update data:", JSON.stringify(updatePayload, null, 2));
        const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore batch update error.';
        throw new Error(`Could not perform batch update on agent tasks. Reason: ${errorMessage}`);
    }
};

/**
 * Retrieves a single agent task by its ID.
 * @param taskId The ID of the task document to retrieve.
 * @returns The agent task data object or null if not found.
 */
export const getAgentTask = async (taskId: string): Promise<AgentTaskPayload | null> => {
    if (!taskId) {
        console.error("getAgentTask called with invalid taskId:", taskId);
        return null; // Or throw an error
    }
    const taskRef = doc(db, "agentTasks", taskId);
    try {
        const docSnap = await getDoc(taskRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Convert timestamps
            return {
                ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt : undefined,
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt : undefined,
            } as AgentTaskPayload;
        } else {
            console.log("No such agent task document with ID:", taskId);
            return null;
        }
    } catch (error: any) {
        console.error(`Error getting agent task ${taskId}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown Firestore get error.';
        throw new Error(`Could not retrieve agent task ${taskId}. Reason: ${errorMessage}`);
    }
};
