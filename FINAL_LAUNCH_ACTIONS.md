# Final Launch Actions

## Must Complete Outside The Code

- Publish a public Privacy Policy page using `PRIVACY_POLICY.md`
- Publish a public Terms of Service page using `TERMS_OF_SERVICE.md`
- Turn on 2FA for GitHub, Supabase, Apple Developer, and Google Play
- Verify Apple Developer enrollment is approved
- Prepare Google Play Console access if launching on Android
- Secure your domain and support email addresses
- Decide your legal business entity and ownership structure
- Review whether you need trademark filing for the app name and logo

## App Store Submission Prep

- Prepare app description
- Prepare screenshots for phone screens
- Prepare app icon and splash assets final versions
- Fill App Store privacy questions
- Fill Google Play Data safety form
- Provide support URL, privacy policy URL, and contact email
- Test a production build, not only local Expo preview

## Final Technical Checks

- Confirm latest `supabase/schema.sql` is applied in production
- Confirm email confirmation works with a brand-new email
- Confirm duplicate email shows `Email already registered`
- Confirm backup copies still exist and are accessible
- Confirm `.env` remains private and is not tracked by git
- Confirm no `service_role` key is used in the app
- Confirm all critical user flows work on a real phone

## Operational Readiness

- Keep a private offline backup
- Keep GitHub backup current
- Keep a breach and outage response plan
- Monitor signup, login, messaging, and upload issues after launch
