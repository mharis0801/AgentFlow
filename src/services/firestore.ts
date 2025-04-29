import { db } from "@/lib/firebase/firebase";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

interface UserData {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: any; // Use 'any' for FieldValue or handle serverTimestamp correctly
}

/**
 * Adds or updates user data in Firestore.
 * Creates the document if it doesn't exist based on the UID.
 * @param user The user object from Firebase Auth.
 */
export const upsertUser = async (user: { uid: string; email: string | null; displayName: string | null }): Promise<void> => {
  const userRef = doc(db, "users", user.uid);

  const userData: UserData = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'User', // Provide a default display name
    createdAt: serverTimestamp(), // Use server timestamp for creation time
  };

  try {
    // Use setDoc with merge: true to create or update
    await setDoc(userRef, userData, { merge: true });
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
      return docSnap.data() as UserData;
    } else {
      console.log("No such user document!");
      return null;
    }
  } catch (error) {
    console.error("Error getting user data:", error);
    throw new Error("Could not retrieve user data.");
  }
};
