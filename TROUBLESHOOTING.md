# Troubleshooting Guide - Doña Lina Stock

This guide covers common issues and their solutions.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [Sync and Connectivity Issues](#sync-and-connectivity-issues)
- [Performance Issues](#performance-issues)
- [Data Issues](#data-issues)
- [Deployment Issues](#deployment-issues)
- [Browser Compatibility](#browser-compatibility)

## Authentication Issues

### "Invalid token" Error

**Symptoms:**
- Error message when trying to save token
- Can't access data after entering token

**Solutions:**

1. **Verify token scope:**
   - Go to https://github.com/settings/tokens
   - Check that your token has the `gist` scope enabled
   - If not, create a new token with the correct scope

2. **Check token expiration:**
   - Tokens can expire based on the expiration date you set
   - Create a new token if expired
   - Consider setting a longer expiration period

3. **Verify token format:**
   - Classic tokens start with `ghp_`
   - Fine-grained tokens start with `github_pat_`
   - Make sure you copied the entire token (no spaces or line breaks)

4. **Test token manually:**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/gists
   ```
   - Should return a list of your gists
   - If it returns 401, the token is invalid

### "Unauthorized" or 401 Errors

**Cause:** Token doesn't have required permissions or has been revoked

**Solution:**
1. Generate a new token with `gist` scope
2. Update token in Settings
3. If you revoked the old token, create a new one

### Token Not Saving

**Symptoms:**
- Token disappears after page reload
- Have to re-enter token every time

**Solutions:**

1. **Check browser localStorage:**
   - Open browser DevTools (F12)
   - Go to Application → Local Storage
   - Check if `github_token` exists
   - If not, your browser may be blocking localStorage

2. **Private/Incognito mode:**
   - Some browsers clear localStorage in private mode
   - Use normal browsing mode for persistent storage

3. **Browser extensions:**
   - Privacy extensions may block localStorage
   - Try disabling extensions temporarily

## Sync and Connectivity Issues

### "Remote changes detected" Conflict

**Symptoms:**
- Modal appears saying remote changes were detected
- Can't save changes

**Cause:** The Gist was modified from another device, browser tab, or by another user

**Solutions:**

1. **Reload data (Recommended):**
   - Click "Reload" in the conflict modal
   - Your local changes are preserved in the offline queue
   - Review changes and re-apply if needed

2. **Force save (Use with caution):**
   - Only if you're certain your local data is correct
   - May overwrite remote changes

3. **Prevention:**
   - Avoid using the app in multiple tabs simultaneously
   - Sync before making changes on a different device
   - Check sync status before major edits

### "Pending sync" Status Stuck

**Symptoms:**
- Sync status shows "Pending" for a long time
- Changes not appearing in GitHub Gist

**Solutions:**

1. **Check internet connection:**
   - Verify you're online
   - Try accessing github.com in another tab

2. **Check GitHub status:**
   - Visit https://www.githubstatus.com/
   - API may be experiencing issues

3. **Manual retry:**
   - Go to Settings → Data Management
   - Click "Retry Sync" or "Force Sync"

4. **Check offline queue:**
   - Settings → Data Management → View Offline Queue
   - See pending operations
   - Clear queue if needed (will lose pending changes)

### Rate Limit Exceeded

**Symptoms:**
- Error: "API rate limit exceeded"
- 403 status code

**Cause:** GitHub API limits requests to 5,000/hour for authenticated users

**Solutions:**

1. **Wait and retry:**
   - The app automatically retries with exponential backoff
   - Rate limits reset every hour

2. **Check rate limit status:**
   ```bash
   curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/rate_limit
   ```

3. **Reduce sync frequency:**
   - Batch changes instead of saving after each edit
   - Use offline mode and sync periodically

### Network Timeout Errors

**Symptoms:**
- "Request timeout" errors
- Sync fails intermittently

**Solutions:**

1. **Check connection stability:**
   - Test with other websites
   - Try a different network

2. **Retry automatically:**
   - The app retries failed requests automatically
   - Wait a few seconds for retry

3. **Manual sync:**
   - Settings → Data Management → "Force Sync"

## Performance Issues

### Slow Product Search

**Symptoms:**
- Search takes several seconds
- UI freezes when typing

**Solutions:**

1. **Use category filters:**
   - Filter by category first to reduce search space
   - Then search within category

2. **Clear browser cache:**
   - Settings → Data Management → "Clear Cache"
   - Reload the page

3. **Optimize dataset:**
   - Archive inactive products
   - Remove duplicate entries

4. **Check product count:**
   - App is optimized for 1,000-5,000 products
   - Performance may degrade with 10,000+ products

### Slow Initial Load

**Symptoms:**
- App takes 10+ seconds to load first time
- Blank screen on startup

**Solutions:**

1. **Normal behavior:**
   - First load fetches from GitHub Gist (can take 3-5 seconds)
   - Subsequent loads use cache (instant)

2. **Check network speed:**
   - Slow connection affects initial load
   - Try on a faster network

3. **Reduce data size:**
   - Export and archive old movements/purchases
   - Keep only recent data in active Gist

4. **Clear cache and reload:**
   - Settings → Data Management → "Clear Cache"
   - Forces fresh load from Gist

### High Memory Usage

**Symptoms:**
- Browser tab uses excessive RAM
- Browser becomes sluggish

**Solutions:**

1. **Close unused tabs:**
   - Each tab loads full dataset into memory

2. **Reload page periodically:**
   - Clears accumulated memory
   - Especially after bulk operations

3. **Archive old data:**
   - Move old movements/purchases to backup
   - Keep only recent months active

## Data Issues

### Missing Products or Data

**Symptoms:**
- Products disappeared
- Data not showing after login

**Solutions:**

1. **Verify correct token:**
   - Make sure you're using the right GitHub account
   - Check which Gist the token has access to

2. **Check Gist directly:**
   - Go to https://gist.github.com/
   - Find your "dona-lina-stock" Gist
   - Verify data is present in JSON files

3. **Restore from backup:**
   - If you have a backup, use Settings → Import Backup
   - Check other devices if you used the app there

4. **Check browser:**
   - Try a different browser
   - Clear cache and reload

### Incorrect Stock Calculations

**Symptoms:**
- Stock numbers don't match expectations
- Negative stock when shouldn't be

**Solutions:**

1. **Refresh stock snapshots:**
   - Settings → Data Management → "Refresh Snapshots"
   - Recalculates stock from movement history

2. **Verify movements:**
   - Go to Movements screen
   - Filter by product
   - Check all entries are correct

3. **Check for duplicate movements:**
   - Look for duplicate timestamps
   - Remove duplicates if found

4. **Audit trail:**
   - Review adjustment movements
   - Verify manual adjustments are correct

### Wrong Cost Calculations

**Symptoms:**
- Cost doesn't match recent purchases
- Margin calculations seem off

**Solutions:**

1. **Check cost method:**
   - Settings → Cost Calculation Method
   - Verify "Last Cost" or "Weighted Average" is correct

2. **Verify purchase history:**
   - Go to Purchases screen
   - Check recent purchases for the product
   - Ensure unit costs are correct

3. **Check weighted average settings:**
   - If using weighted average, verify window settings
   - Settings → Weighted Average Window

4. **Recalculate costs:**
   - Settings → Data Management → "Recalculate Costs"

### CSV Import Failures

**Symptoms:**
- Import fails with validation errors
- Data not imported correctly

**Solutions:**

1. **Check CSV format:**
   - Ensure headers match expected columns
   - Required: name, unit
   - Optional: category, sku, minStock, salePriceCents

2. **Verify data types:**
   - `unit` must be: "lt", "kg", or "unit"
   - `minStock` must be a number
   - `salePriceCents` must be an integer (cents)

3. **Check for special characters:**
   - Remove or escape commas in product names
   - Use UTF-8 encoding

4. **Preview before import:**
   - Use the preview feature
   - Fix errors before confirming

## Deployment Issues

### GitHub Pages Not Working

**Symptoms:**
- 404 error on GitHub Pages URL
- Blank page after deployment

**Solutions:**

1. **Enable GitHub Pages:**
   - Repository Settings → Pages
   - Source: "GitHub Actions"
   - Wait a few minutes for deployment

2. **Check base path:**
   - Open `vite.config.ts`
   - Verify `base: '/your-repo-name/'` matches your repository name
   - Must include leading and trailing slashes

3. **Check workflow status:**
   - Go to Actions tab in GitHub
   - Verify deployment workflow succeeded
   - Check logs for errors

4. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear cache in browser settings

### Build Fails in GitHub Actions

**Symptoms:**
- Deployment workflow fails
- Red X on commit in GitHub

**Solutions:**

1. **Check workflow logs:**
   - Actions tab → Click failed workflow
   - Review error messages

2. **Common issues:**
   - TypeScript errors: Fix in code and push
   - Missing dependencies: Verify package.json
   - Node version: Workflow uses Node 20

3. **Test locally:**
   ```bash
   npm run build
   ```
   - Fix any errors before pushing

4. **Check permissions:**
   - Settings → Actions → General
   - Workflow permissions: "Read and write permissions"

### Assets Not Loading (404s)

**Symptoms:**
- CSS not loading
- Images broken
- JavaScript errors

**Cause:** Incorrect base path configuration

**Solution:**
1. Update `vite.config.ts`:
   ```typescript
   base: '/your-exact-repo-name/'
   ```
2. Rebuild and redeploy:
   ```bash
   npm run build
   git add .
   git commit -m "Fix base path"
   git push
   ```

## Browser Compatibility

### IndexedDB Not Available

**Symptoms:**
- "IndexedDB not supported" error
- Cache not working

**Solutions:**

1. **Update browser:**
   - Use latest version of Chrome, Firefox, Safari, or Edge
   - IndexedDB is supported in all modern browsers

2. **Check private mode:**
   - Some browsers disable IndexedDB in private/incognito mode
   - Use normal browsing mode

3. **Check browser settings:**
   - Ensure cookies and site data are enabled
   - Some privacy settings block IndexedDB

### LocalStorage Blocked

**Symptoms:**
- Token not saving
- Settings not persisting

**Solutions:**

1. **Enable cookies:**
   - Browser settings → Privacy → Allow cookies
   - Allow for the specific site

2. **Disable privacy extensions:**
   - Extensions like Privacy Badger may block storage
   - Whitelist your GitHub Pages domain

3. **Check browser mode:**
   - Don't use private/incognito mode for persistent storage

## Still Having Issues?

If none of these solutions work:

1. **Export your data:**
   - Settings → Data Management → "Export Backup"
   - Save the JSON file

2. **Clear everything:**
   - Settings → Data Management → "Clear All Data"
   - Logout and clear browser cache

3. **Fresh start:**
   - Re-enter token
   - Import backup if needed

4. **Check browser console:**
   - Open DevTools (F12)
   - Go to Console tab
   - Look for error messages
   - Share errors with support

5. **Try different browser:**
   - Test in Chrome, Firefox, or Edge
   - Helps identify browser-specific issues

## Preventive Measures

To avoid issues:

- ✅ **Regular backups:** Export backup weekly
- ✅ **Single tab:** Use app in one tab at a time
- ✅ **Stable connection:** Avoid making changes on unstable networks
- ✅ **Token rotation:** Regenerate token every 90 days
- ✅ **Monitor sync status:** Check before closing the app
- ✅ **Archive old data:** Keep dataset manageable
- ✅ **Test imports:** Preview CSV before importing
- ✅ **Update browser:** Keep browser up to date
