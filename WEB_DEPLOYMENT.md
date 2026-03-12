# Public Web App Deployment

This project can be deployed as a public web app separately from the legal GitHub Pages site.

## Recommended Setup

- Keep GitHub Pages for:
  - `privacy-policy.html`
  - `terms-of-service.html`
  - support/legal links for Apple
- Use Netlify for the real app web URL

## Why

The app is an Expo web build. Netlify is a simple fit because it can:

- build from GitHub
- host the generated `dist` folder
- serve the app on a public URL

## Files Already Added

- `package.json`
  - script: `npm run export:web`
- `netlify.toml`
  - builds the Expo web app
  - publishes `dist`

## Deploy Steps

1. Push your latest code to GitHub
2. Go to Netlify
3. Choose `Add new site` -> `Import an existing project`
4. Connect your GitHub repo: `paulaboza21/globalsportsid`
5. Netlify should detect:
   - Build command: `npm run export:web`
   - Publish directory: `dist`
6. Add environment variables in Netlify:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_APP_URL`

## Important

For production web auth flows, set:

- `EXPO_PUBLIC_APP_URL=https://your-real-netlify-url.netlify.app`

Later, if you add a custom domain, update it again:

- `EXPO_PUBLIC_APP_URL=https://app.yourdomain.com`

## Supabase

After you know the real public app URL:

1. Go to Supabase -> Authentication -> URL Configuration
2. Set `Site URL` to your public app URL
3. Add Redirect URL:
   - `https://your-real-netlify-url.netlify.app/**`

This is important for:

- password reset
- email confirmation
- auth redirects

## Apple

This public web app URL is separate from your Apple legal links.

Use:

- GitHub Pages legal site for `Privacy Policy URL`
- Netlify app URL if you want a public website/app link
