# Deployment Guide - Doña Lina Stock

This guide walks you through deploying the Doña Lina Stock app to GitHub Pages.

## Prerequisites

Before deploying, ensure you have:

- ✅ A GitHub account
- ✅ Git installed on your computer
- ✅ Node.js (v18+) and npm installed
- ✅ The project code on your local machine

## Deployment Options

There are two ways to deploy:

1. **Automated Deployment** (Recommended) - Uses GitHub Actions
2. **Manual Deployment** - Uses gh-pages package

## Option 1: Automated Deployment with GitHub Actions

This is the recommended approach. The app will automatically deploy whenever you push to the `main` branch.

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Create a new repository:
   - Name: `dona-lina-stock` (or your preferred name)
   - Visibility: Private (recommended) or Public
   - Don't initialize with README (we already have one)
3. Click "Create repository"

### Step 2: Configure Base Path

The base path must match your repository name.

1. Open `vite.config.ts`
2. Update the `base` property:
   ```typescript
   export default defineConfig({
     plugins: [react()],
     base: '/your-repo-name/', // ⚠️ Must match your repository name exactly
     // ... rest of config
   })
   ```
3. **Important:** Include both leading and trailing slashes!

Examples:
- Repository: `dona-lina-stock` → `base: '/dona-lina-stock/'`
- Repository: `my-stock-app` → `base: '/my-stock-app/'`
- Repository: `inventory` → `base: '/inventory/'`

### Step 3: Push Code to GitHub

If this is your first push:

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace with your repository URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to main branch
git branch -M main
git push -u origin main
```

If you already have a repository:

```bash
git add .
git commit -m "Configure for deployment"
git push
```

### Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under **Source**, select **"GitHub Actions"**
5. Click **Save**

### Step 5: Wait for Deployment

1. Go to the **Actions** tab in your repository
2. You should see a workflow running: "Deploy to GitHub Pages"
3. Wait for it to complete (usually 1-2 minutes)
4. Green checkmark = successful deployment ✅
5. Red X = failed deployment ❌ (check logs)

### Step 6: Access Your App

Once deployed, your app will be available at:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

Example:
- Username: `johndoe`
- Repository: `dona-lina-stock`
- URL: `https://johndoe.github.io/dona-lina-stock/`

### Step 7: Verify Deployment

1. Open the URL in your browser
2. You should see the login screen
3. Enter your GitHub PAT token
4. Verify the app works correctly

## Option 2: Manual Deployment

Use this if you prefer manual control or GitHub Actions isn't available.

### Step 1: Install gh-pages Package

The package is already included in `package.json`, but verify:

```bash
npm install
```

### Step 2: Configure Base Path

Same as Option 1, Step 2 - update `vite.config.ts` with correct base path.

### Step 3: Build and Deploy

```bash
# Build and deploy in one command
npm run deploy
```

This will:
1. Build the production bundle
2. Create/update the `gh-pages` branch
3. Push the `dist` folder to that branch

### Step 4: Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **"Deploy from a branch"**
3. Select branch: **gh-pages**
4. Select folder: **/ (root)**
5. Click **Save**

### Step 5: Access Your App

Wait 1-2 minutes, then visit:
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

## Updating Your Deployment

### With GitHub Actions (Option 1)

Simply push changes to the `main` branch:

```bash
git add .
git commit -m "Update feature X"
git push
```

The workflow will automatically rebuild and redeploy.

### With Manual Deployment (Option 2)

Run the deploy command again:

```bash
npm run deploy
```

## Troubleshooting Deployment

### Issue: 404 Page Not Found

**Cause:** Base path doesn't match repository name

**Solution:**
1. Check `vite.config.ts` - `base` must match repo name exactly
2. Rebuild and redeploy:
   ```bash
   npm run build
   npm run deploy  # or push to trigger Actions
   ```

### Issue: Blank Page After Deployment

**Cause:** Assets not loading due to incorrect paths

**Solution:**
1. Open browser DevTools (F12) → Console
2. Look for 404 errors on CSS/JS files
3. Verify base path in `vite.config.ts`
4. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

### Issue: GitHub Actions Workflow Fails

**Cause:** Build errors or permission issues

**Solution:**
1. Go to Actions tab → Click failed workflow
2. Read error logs
3. Common fixes:
   - TypeScript errors: Fix and push
   - Permission denied: Settings → Actions → Workflow permissions → "Read and write"
   - Node version: Workflow uses Node 20, test locally with same version

### Issue: Changes Not Appearing

**Cause:** Browser cache or deployment not complete

**Solution:**
1. Wait 2-3 minutes for deployment to complete
2. Hard refresh browser: Ctrl+Shift+R
3. Clear browser cache
4. Check Actions tab for workflow status

### Issue: CSS/Styles Not Loading

**Cause:** Base path mismatch

**Solution:**
1. Verify `base` in `vite.config.ts` matches repo name
2. Check browser console for 404 errors
3. Rebuild:
   ```bash
   npm run build
   ```
4. Verify `dist/index.html` has correct asset paths

## Testing Before Deployment

Always test the production build locally before deploying:

```bash
# Build for production
npm run build

# Preview the build
npm run preview
```

Visit `http://localhost:4173/your-repo-name/` and verify:
- ✅ App loads correctly
- ✅ All pages work
- ✅ Assets load (CSS, images)
- ✅ Navigation works
- ✅ Can login with token
- ✅ Data operations work

## Custom Domain (Optional)

To use a custom domain instead of `username.github.io`:

### Step 1: Configure DNS

Add a CNAME record in your domain registrar:
```
CNAME: www.yourdomain.com → YOUR_USERNAME.github.io
```

### Step 2: Add CNAME File

Create `public/CNAME` file:
```
www.yourdomain.com
```

### Step 3: Update GitHub Pages Settings

1. Repository Settings → Pages
2. Custom domain: `www.yourdomain.com`
3. Check "Enforce HTTPS"
4. Save

### Step 4: Update Base Path

In `vite.config.ts`:
```typescript
base: '/', // Root path for custom domain
```

Rebuild and redeploy.

## Security Considerations

### Repository Visibility

**Private Repository (Recommended):**
- ✅ Code is not publicly visible
- ✅ GitHub Pages still works
- ✅ Only you can see the repository
- ⚠️ Requires GitHub Pro for private repo Pages (or use public)

**Public Repository:**
- ⚠️ Anyone can see your code
- ✅ Free GitHub Pages
- ⚠️ Don't commit tokens or secrets

### Protecting Secrets

**Never commit:**
- ❌ GitHub PAT tokens
- ❌ API keys
- ❌ Passwords
- ❌ Personal data

**The app stores tokens in:**
- Browser localStorage (user's device)
- Never in the repository
- Never in the deployed code

### HTTPS

- ✅ GitHub Pages automatically provides HTTPS
- ✅ Always use HTTPS URLs
- ✅ Enforce HTTPS in Pages settings

## Monitoring Deployment

### Check Deployment Status

**Via GitHub Actions:**
1. Actions tab → Latest workflow
2. Green = success, Red = failed
3. Click for detailed logs

**Via GitHub Pages:**
1. Settings → Pages
2. Shows current deployment status
3. "Your site is live at..." = successful

### View Deployment History

**GitHub Actions:**
- Actions tab shows all deployments
- Click any workflow to see details
- Can re-run failed workflows

**gh-pages Branch:**
- Check `gh-pages` branch for deployed files
- Each deployment is a commit
- Can rollback by reverting commits

## Rollback Deployment

If a deployment breaks something:

### With GitHub Actions

1. Find the last working commit
2. Revert the breaking commit:
   ```bash
   git revert HEAD
   git push
   ```
3. Or reset to last working commit:
   ```bash
   git reset --hard COMMIT_HASH
   git push --force
   ```

### With Manual Deployment

1. Checkout last working commit:
   ```bash
   git checkout COMMIT_HASH
   ```
2. Deploy:
   ```bash
   npm run deploy
   ```
3. Return to main:
   ```bash
   git checkout main
   ```

## Performance Optimization

### Build Optimization

The build is already optimized with:
- ✅ Code splitting (React, vendor, services)
- ✅ Minification
- ✅ Tree shaking
- ✅ Source maps (for debugging)

### Further Optimization

1. **Analyze bundle size:**
   ```bash
   npm run build
   # Check dist/ folder sizes
   ```

2. **Reduce bundle size:**
   - Remove unused dependencies
   - Lazy load heavy components
   - Optimize images

3. **CDN (Advanced):**
   - Use Cloudflare or similar
   - Cache static assets
   - Faster global delivery

## Continuous Deployment

The GitHub Actions workflow automatically deploys on every push to `main`. This enables:

- ✅ Automatic deployments
- ✅ No manual steps needed
- ✅ Consistent builds
- ✅ Deployment history

**Best Practices:**
1. Test locally before pushing
2. Use feature branches for development
3. Merge to `main` only when ready
4. Monitor Actions tab after push
5. Verify deployment before announcing

## Multi-Environment Setup (Advanced)

To have separate staging and production environments:

### Step 1: Create Staging Branch

```bash
git checkout -b staging
git push -u origin staging
```

### Step 2: Duplicate Workflow

Create `.github/workflows/deploy-staging.yml`:
```yaml
name: Deploy to Staging
on:
  push:
    branches:
      - staging
# ... rest same as deploy.yml
```

### Step 3: Use Different Base Paths

- Production: `base: '/dona-lina-stock/'`
- Staging: `base: '/dona-lina-stock-staging/'`

### Step 4: Deploy

- Push to `staging` → deploys to staging URL
- Push to `main` → deploys to production URL

## Conclusion

You now have a fully deployed Doña Lina Stock app on GitHub Pages!

**Next Steps:**
1. ✅ Create your GitHub PAT token
2. ✅ Login to the app
3. ✅ Start adding products
4. ✅ Share the URL with authorized users

**Need Help?**
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [README.md](./README.md)
- Check GitHub Actions logs
- Verify browser console for errors
