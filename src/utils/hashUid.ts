// ==========================================
// UID ANONYMISATION LAYER
// ==========================================
// We NEVER store raw Firebase UIDs in Firestore documents.
// Instead, every UID is run through SHA-256 before it touches the DB.
//
// Why SHA-256?
//   • Deterministic: same uid → same hash every time (needed for voting toggle)
//   • One-way: hash → uid is computationally infeasible
//   • Collision resistant: no two users share a hash
//
// The output is truncated to 16 hex chars (64 bits of entropy) — more than
// enough for a campus-scale app while keeping Firestore integers small.

const SALT = 'base67-iitdh-v1'; // bump version to invalidate all hashes if needed

export async function hashUid(uid: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(SALT + uid);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0, 16); // 64-bit prefix — unique enough for this scale
}

// Synchronous cache so components don't re-hash on every render
const hashCache = new Map<string, string>();

export function getCachedHash(uid: string): string | undefined {
    return hashCache.get(uid);
}

export function setCachedHash(uid: string, hash: string): void {
    hashCache.set(uid, hash);
}
