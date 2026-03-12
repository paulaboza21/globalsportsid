# Legal Page Publishing

These files are ready to publish publicly for Apple App Store submission:

- `index.html`
- `privacy-policy.html`
- `terms-of-service.html`

## Fastest Option: GitHub Pages

1. Push the repo to GitHub
2. Open the repo on GitHub
3. Go to `Settings` -> `Pages`
4. Under `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
5. Click `Save`
6. Wait a minute or two for GitHub Pages to publish

Your pages should then be available at URLs like:

- `https://paulaboza21.github.io/globalsportsid/`
- `https://paulaboza21.github.io/globalsportsid/privacy-policy.html`
- `https://paulaboza21.github.io/globalsportsid/terms-of-service.html`

## Other Hosting Options

You can also upload the same files to any static host, such as:

- GitHub Pages
- Netlify
- Vercel
- your own website/domain

## URLs You Will Need

After publishing, you should have public URLs like:

- `https://yourdomain.com/privacy-policy.html`
- `https://yourdomain.com/terms-of-service.html`

## Apple App Store Connect

Use:

- `Privacy Policy URL`: your published privacy policy page
- `Support URL`: your website root or terms page if needed
- `Contact Email`: `info@globalsportsid.com`

## Save And Push

```bash
git add .
git commit -m "Add publish-ready legal pages"
git push
```
