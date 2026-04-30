# Firestore Security Specification - Decor2Go Management

## 1. Data Invariants
- Only verified admin (`victoria@decor2go.ca`) can read, create, update, or delete records.
- Orders must have an `orderDate`, `invoiceNumber`, `clientName`, and `status`.
- `status` must be one of: `none`, `ordered`, `received`.
- Timestamps `createdAt` and `updatedAt` must be valid server timestamps.

## 2. The "Dirty Dozen" Payloads (Targeting `orders`)
1. **Unauthenticated Read**: Attempt to list orders without being signed in. (Denied)
2. **Unverified Email Read**: Attempt to read orders with a non-admin email. (Denied)
3. **Identity Spoofing**: Attempt to create an order as a different user (not applicable since we only have one admin, but generic rule). (Denied)
4. **Invalid Status**: Create order with `status: 'shipped'`. (Denied)
5. **Missing Required Field**: Create order without `invoiceNumber`. (Denied)
6. **Large Document ID**: Create a document with an ID exceeding 128 characters or containing illegal characters. (Denied)
7. **Bypassing Server Timestamps**: Create order with a client-side date for `createdAt`. (Denied)
8. **Shadow Field Injection**: Update order with an extra field `isVerified: true`. (Denied)
9. **Invalid Type**: Set `invoiceNumber` to a boolean instead of a string. (Denied)
10. **Modification of Immutable Field**: Attempt to change `createdAt` during an update. (Denied)
11. **Malicious ID Injection**: Use path traversal characters in the document ID. (Denied)
12. **Denial of Wallet**: Attempt to list orders with a complex query that bypasses filters (if applicable). (Denied)

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would be used to verify these rules locally if we had a full test suite environment. For now, we will rely on strict rule definitions and manual verification.
