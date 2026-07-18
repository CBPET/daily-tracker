# Firebase Hosting Setup

Use this guide to deploy CBPET Daily Tracker as a Vite single-page app on Firebase Hosting.

## 1. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

## 2. Initialize Hosting

From the project root:

```bash
firebase init hosting
```

Use these answers:

```text
Public directory: dist
Configure as a single-page app: Yes
Set up automatic builds and deploys with GitHub: Optional
Overwrite dist/index.html: No
```

## 3. Environment Variables

The Vite build needs these values before running `npm run build`:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

For local builds, put them in `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

For CI builds, store them as CI secrets and expose them only during the build step.

The anon key is expected to be bundled into frontend JavaScript. This is safe only when Supabase Row Level Security policies correctly restrict data access.

Never put `SUPABASE_SERVICE_ROLE_KEY` in Firebase Hosting config, frontend code, or client-visible environment files.

## 4. Firebase Hosting Rewrite

Firebase should serve `index.html` for app routes. A typical `firebase.json` looks like:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

## 5. Vite Base Path

Firebase Hosting usually serves from the domain root, so the Vite base can be `/`.

This repository is currently configured for GitHub Pages with:

```js
base: '/daily-tracker/'
```

If Firebase becomes the primary deployment target, change the base path or make it environment-specific before deploying.

## 6. Supabase Auth URLs

In **Supabase Dashboard -> Authentication -> URL Configuration**, add the Firebase Hosting URL:

```text
https://your-project.web.app/
https://your-project.firebaseapp.com/
```

Also add any custom domain.

Auth redirect URLs should use the app base URL without a `#` fragment.

## 7. Build and Deploy

```bash
npm ci
npm run build
firebase deploy --only hosting
```

After deployment, verify:

- The app loads.
- Login works.
- Invite and password reset links return to the Firebase Hosting URL.
- Supabase requests do not fail due to missing environment variables.
