# Data Storage Documentation

## Overview

This document describes where and how Doña Lina Stock stores data. This information is important for understanding data privacy, backup procedures, and troubleshooting.

## Storage Locations

### 1. Browser Local Storage

**Technology:** HTML5 localStorage API  
**Persistence:** Permanent (until manually cleared)  
**Scope:** Per-origin (specific to the domain where the app is hosted)

**Keys Used:**
- `dona_lina_token` - GitHub Personal Access Token (plain text)
- `dona_lina_encrypted_token` - Encrypted GitHub PAT (when encryption is enabled)
- `dona_lina_encryption_enabled` - Boolean flag for encryption status
- `dona_lina_gist_id` - GitHub Gist ID for remote storage

**Access:**
- Browser DevTools → Application → Local Storage
- Can be cleared via browser settings or app logout

**Security:**
- Tokens can be optionally encrypted with AES-GCM
- Never logged to console
- Cleared on logout

---

### 2. Browser IndexedDB

**Technology:** IndexedDB API  
**Database Name:** `DonaLinaStockDB`  
**Persistence:** Permanent (until manually cleared)  
**Scope:** Per-origin

**Object Stores:**
- `products` - Product catalog cache
- `suppliers` - Supplier information cache
- `movements` - Stock movements cache
- `purchases` - Purchase records cache
- `settings` - Application settings cache
- `meta` - Metadata and snapshots cache

**Access:**
- Browser DevTools → Application → IndexedDB → DonaLinaStockDB
- Can be cleared via browser settings or app logout

**Purpose:**
- Fast local cache for offline access
- Reduces API calls to GitHub
- Improves app performance

---

### 3. GitHub Gist (Remote Storage)

**Technology:** GitHub Gist API  
**Persistence:** Permanent (until Gist is deleted)  
**Scope:** User's GitHub account

**Files Stored:**
- `products.json` - Complete product catalog
- `suppliers.json` - Supplier information
- `movements_YYYY_MM.json` - Stock movements (partitioned by month)
- `purchases_YYYY_MM.json` - Purchase records (partitioned by month)
- `settings.json` - Application settings
- `meta.json` - Metadata, schema version, and stock snapshots

**Access:**
- GitHub.com → Your Gists → [Gist ID]
- Via GitHub API with PAT token
- Can be deleted directly from GitHub

**Security:**
- Access controlled by GitHub PAT token
- Can be private or public (recommend private)
- ETag-based concurrency control
- You own and control the data

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        User Action                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    React Application                        │
│  (Business Logic, Validation, State Management)             │
└────────────┬───────────────────────────────┬────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐    ┌─────────────────────────────┐
│   IndexedDB Cache      │    │   GitHub Gist API           │
│   (Local, Fast)        │    │   (Remote, Persistent)      │
│                        │    │                             │
│   - Read: Instant      │    │   - Read: Network call      │
│   - Write: Async       │    │   - Write: Network call     │
│   - Cleared on logout  │    │   - ETag concurrency        │
└────────────────────────┘    └─────────────────────────────┘
```

**Read Flow:**
1. App checks IndexedDB cache first
2. If cache miss or stale, fetch from GitHub Gist
3. Update cache with fresh data
4. Return data to UI

**Write Flow:**
1. Validate data in application
2. Write to GitHub Gist (with ETag)
3. On success, update IndexedDB cache
4. Update UI state

---

## Data Clearing Procedures

### Complete Data Removal

To completely remove all application data:

1. **Logout from App**
   - Settings → Authentication → "Cerrar Sesión"
   - Clears localStorage and IndexedDB
   - Does NOT delete GitHub Gist

2. **Delete GitHub Gist**
   - Go to GitHub.com → Your Gists
   - Find the Gist by ID
   - Click "Delete" button
   - Permanently removes remote data

3. **Clear Browser Data** (optional)
   - Browser Settings → Privacy → Clear browsing data
   - Select "Cookies and site data"
   - Select the time range
   - Removes any residual data

### Partial Data Clearing

**Clear Cache Only:**
- Settings → Data Management → "Borrar Caché Local"
- Keeps authentication but clears cached data
- Next load will fetch fresh data from GitHub

**Clear Specific Records:**
- Delete individual products, suppliers, movements, or purchases
- Changes are synced to GitHub Gist
- Permanent deletion (no undo)

---

## Backup and Export

### Manual Backups

**Full Backup (JSON):**
- Settings → Data Management → "Exportar Backup"
- Downloads complete data as JSON file
- Can be used for manual restore or migration

**CSV Export:**
- Settings → Data Management → "Exportar CSV"
- Exports product catalog only
- Useful for sharing or printing

### Automatic Backups

The application does NOT perform automatic backups. You should:
- Export backups regularly
- Keep GitHub Gist as primary backup
- Consider GitHub's built-in Gist history

---

## Privacy Considerations

### No PII Stored

The application does NOT store:
- Customer names, addresses, phone numbers, emails
- Personal identification numbers
- Payment information
- Biometric data
- Location data

### Business Data Only

The application ONLY stores:
- Product information (names, prices, SKUs)
- Supplier business names and notes
- Stock quantities and movements
- Purchase records with costs
- Application settings

See `PRIVACY.md` for complete privacy documentation.

---

## Troubleshooting

### Data Not Syncing

1. Check network connection
2. Verify GitHub PAT token is valid (Settings → Authentication)
3. Check browser console for errors
4. Verify Gist ID is correct
5. Check GitHub API rate limits

### Data Loss Prevention

1. Export backups regularly
2. Don't delete GitHub Gist accidentally
3. Use token encryption for security
4. Keep PAT token secure and backed up
5. Test restore procedure periodically

### Cache Issues

If data appears stale or incorrect:
1. Clear cache: Settings → "Borrar Caché Local"
2. Reload the page
3. Data will be fetched fresh from GitHub

---

## Technical Details

### IndexedDB Schema

```javascript
Database: DonaLinaStockDB
Version: 1

Object Stores:
- products: keyPath = "id"
- suppliers: keyPath = "id"
- movements: keyPath = "id"
- purchases: keyPath = "id"
- settings: keyPath = "id" (single record)
- meta: keyPath = "id" (single record)
```

### GitHub Gist Structure

```
Gist ID: [user-provided]
Files:
  - products.json
  - suppliers.json
  - movements_2024_01.json
  - movements_2024_02.json
  - purchases_2024_01.json
  - purchases_2024_02.json
  - settings.json
  - meta.json
```

### Token Encryption

When enabled:
- Algorithm: AES-GCM (256-bit)
- Key Derivation: PBKDF2 (100,000 iterations, SHA-256)
- Random salt and IV per encryption
- Stored as base64 in localStorage

---

## Compliance

### GDPR
- No personal data of EU residents is processed
- Business data is not considered personal data
- User has full control and ownership of data
- Data can be exported and deleted at any time

### Data Ownership
- User owns all data
- Data stored in user's GitHub account
- No third-party access
- No analytics or tracking

---

## Support

For questions about data storage:
1. Review this document
2. Check `PRIVACY.md` for privacy details
3. Review source code (open source)
4. Contact application maintainer

---

**Last Updated:** 2024-01-15  
**Document Version:** 1.0
