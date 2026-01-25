import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();

// Firestore instance
export const db = admin.firestore();

// Collection references
export const collections = {
    users: db.collection("users"),
    channels: db.collection("channels"),
    listings: db.collection("listings"),
    deals: db.collection("deals"),
    campaigns: db.collection("campaigns"),
    transactions: db.collection("transactions"),
    notifications: db.collection("notifications"),
    wallets: db.collection("wallets"),
};

// Timestamp helper
export const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

// Helper functions
export async function getDoc<T>(
    collection: FirebaseFirestore.CollectionReference,
    id: string
): Promise<T | null> {
    const doc = await collection.doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as T;
}

export async function setDoc(
    collection: FirebaseFirestore.CollectionReference,
    id: string,
    data: Record<string, unknown>
): Promise<void> {
    await collection.doc(id).set(data, { merge: true });
}

export async function addDoc(
    collection: FirebaseFirestore.CollectionReference,
    data: Record<string, unknown>
): Promise<string> {
    const ref = await collection.add({
        ...data,
        createdAt: serverTimestamp(),
    });
    return ref.id;
}

export async function updateDoc(
    collection: FirebaseFirestore.CollectionReference,
    id: string,
    data: Record<string, unknown>
): Promise<void> {
    await collection.doc(id).update({
        ...data,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteDoc(
    collection: FirebaseFirestore.CollectionReference,
    id: string
): Promise<void> {
    await collection.doc(id).delete();
}

export async function queryDocs<T>(
    collection: FirebaseFirestore.CollectionReference,
    field: string,
    operator: FirebaseFirestore.WhereFilterOp,
    value: unknown
): Promise<T[]> {
    const snapshot = await collection.where(field, operator, value).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T);
}
