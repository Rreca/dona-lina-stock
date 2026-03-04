# Privacy and Data Storage Documentation

## Overview

Doña Lina Stock is designed with privacy in mind. The application stores only business-related data and does not collect or store any Personally Identifiable Information (PII) about customers.

## Data Storage Locations

### 1. Browser Local Storage
**Location:** `localStorage` in your browser  
**Purpose:** Authentication and configuration  
**Data Stored:**
- `dona_lina_token` - GitHub Personal Access Token (plain text, if encryption disabled)
- `dona_lina_encrypted_token` - Encrypted GitHub PAT (if encryption enabled)
- `dona_lina_encryption_enabled` - Flag indicating if token encryption is active
- `dona_lina_gist_id` - GitHub Gist ID for data persistence

**Security Notes:**
- Tokens can be optionally encrypted with a passphrase using AES-GCM encryption
- Tokens are never logged to console or error messages
- All token data is cleared on logout

### 2. Browser IndexedDB
**Location:** IndexedDB database named `DonaLinaStockDB` in your browser  
**Purpose:** Local cache for fast data access  
**Data Stored:**
- Products catalog (names, categories, SKUs, prices, stock levels)
- Suppliers (business names and notes only)
- Stock movements (product movements, quantities, dates)
- Purchases (purchase records with costs and quantities)
- Application settings (cost calculation methods, pricing rules)

**Security Notes:**
- Cache is automatically cleared on logout
- No customer personal information is stored
- All data is business-related only

### 3. GitHub Gist (Remote Storage)
**Location:** Your GitHub account's private Gist  
**Purpose:** Persistent data storage  
**Data Stored:**
- `products.json` - Product catalog
- `suppliers.json` - Supplier information
- `movements_YYYY_MM.json` - Stock movements (partitioned by month)
- `purchases_YYYY_MM.json` - Purchase records (partitioned by month)
- `settings.json` - Application settings
- `meta.json` - Metadata and stock snapshots

**Security Notes:**
- Data is stored in your personal GitHub account
- Access controlled by your GitHub PAT token
- You have full control over the Gist (can delete anytime)
- Gist can be private or public (recommend private)

## What Data is NOT Stored

The application explicitly does NOT store:
- ❌ Customer names, addresses, phone numbers, or emails
- ❌ Customer purchase history or preferences
- ❌ Payment information or credit card details
- ❌ Personal identification numbers
- ❌ Biometric data
- ❌ Location tracking data
- ❌ Analytics or usage tracking

## Data You Control

### Supplier Information
The only "personal" data stored is supplier business information:
- Supplier business name
- Optional notes about the supplier

This is business-to-business information, not personal customer data.

### Product Information
Product data includes:
- Product names and descriptions
- Categories and SKUs
- Prices and costs
- Stock quantities

This is business inventory data, not personal information.

## Data Clearing and Privacy Controls

### Complete Data Clearing
To completely remove all data from the application:

1. **Logout** - Click "Cerrar Sesión" in Settings
   - Clears all local storage (tokens, Gist ID)
   - Clears all IndexedDB cache
   - Clears sensitive data from memory

2. **Delete Gist** - Go to GitHub and delete the Gist
   - Permanently removes all remote data
   - Cannot be recovered after deletion

3. **Clear Browser Data** - Use browser settings
   - Clear site data for the application domain
   - Removes any residual storage

### Partial Data Clearing
You can also:
- Export a backup before clearing (Settings → Export Backup)
- Delete specific products, suppliers, or records individually
- Deactivate products instead of deleting them

## Token Security

### Token Storage
- Tokens are stored in browser localStorage
- Optional AES-GCM encryption with passphrase
- Tokens are never logged to console
- Tokens are cleared from memory on logout

### Token Permissions
The application requires minimal GitHub permissions:
- **Required scope:** `gist` only
- No access to repositories, issues, or other GitHub data
- No access to organization data
- No access to user profile beyond validation

### Token Best Practices
1. Use a dedicated token for this application
2. Enable token encryption with a strong passphrase
3. Rotate tokens periodically
4. Revoke tokens immediately if compromised
5. Never share your token with others

## Data Portability

You can export all your data at any time:
- **CSV Export** - Export product catalog to CSV (Settings → Export CSV)
- **Full Backup** - Export complete data as JSON (Settings → Export Backup)
- **Direct Gist Access** - Access raw JSON files in your GitHub Gist

## Compliance Notes

### GDPR Compliance
- No personal data of EU residents is collected or processed
- Business data (suppliers, products) is not considered personal data under GDPR
- You have full control and ownership of all data
- Data can be exported and deleted at any time

### Data Ownership
- You own all data stored in the application
- Data is stored in YOUR GitHub account
- No third-party has access to your data
- No data is sent to external servers (except GitHub API)

## Questions or Concerns

If you have questions about data storage or privacy:
1. Review this document
2. Check the source code (open source)
3. Contact the application maintainer

## Last Updated
This privacy documentation was last updated: 2024-01-15
