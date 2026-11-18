# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Identity Isolation**: A user can only read or write `/users/{userId}`, `/users/{userId}/private/{docId}`, and `/users/{userId}/sessions/{sessionId}` when `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId`.
2. **PII Isolation**: Email and avatar URLs live strictly under `/users/{userId}/private/info` and never inside `/users/{userId}`.
3. **No Privilege Escalation**: `UserProfile.role` must be `'member'` on create and is immutable on update.
4. **Master Gate Sync**: Subcollections `/private/{docId}` and `/sessions/{sessionId}` check parent existence via `exists(/databases/$(database)/documents/users/$(userId))` (or `existsAfter` during atomic batch creation).
5. **Immutable Session Telemetry**: Once a `CognitiveSession` is created with `playedAt == request.time`, it cannot be updated (`allow update: if false`).
6. **Temporal Integrity**: `createdAt`, `updatedAt`, and `playedAt` must equal `request.time`.
7. **Strict Keys & Bounds**: Every document enforces `keys().hasAll(...)` + `keys().hasOnly(...)` on create, `affectedKeys().hasOnly(...)` on update, `isValidId()` on document IDs, and bounded string/numeric ranges.

## 2. The "Dirty Dozen" Attack Payloads (All Must Yield PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/users/u1` with `auth: null`.
2. **Unverified Email Write**: Create `/users/u1` with `auth: { uid: 'u1', token: { email_verified: false } }`.
3. **Cross-User Read**: User `u2` reads `/users/u1` or `/users/u1/sessions/s1`.
4. **Cross-User Spoofed Session Create**: User `u2` creates `/users/u1/sessions/s1` with `userId: 'u2'`.
5. **Role Escalation on Create**: User `u1` creates `/users/u1` with `role: 'admin'`.
6. **Shadow Field Injection on Create**: User `u1` creates `/users/u1` with an extra field `isAdmin: true`.
7. **Shadow Field Injection on Update**: User `u1` updates `/users/u1` modifying `role` or `createdAt` or adding `bonus: 999`.
8. **Oversized ID Poisoning**: User `u1` creates `/users/u1/sessions/<150-char-id>` or invalid character ID `bad/id$`.
9. **Client Timestamp Forgery**: User `u1` creates `/users/u1/sessions/s1` with `playedAt: new Date(0)`.
10. **Session Score Tampering (Update)**: User `u1` updates `/users/u1/sessions/s1` to raise `score: 100`.
11. **Out-of-Bounds Accuracy**: User `u1` creates `/users/u1/sessions/s1` with `accuracyPercent: 150` or `-5`.
12. **PII Leak Attempt**: User `u2` reads `/users/u1/private/info`.
