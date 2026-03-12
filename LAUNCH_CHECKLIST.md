# Global Sports ID Launch Checklist

## Critical

- Run `supabase/schema.sql` in the live Supabase project.
- Confirm Row Level Security and policies are active.
- Verify `.env` is not tracked in git and remains private.
- Confirm GitHub backup is up to date on `main`.
- Keep a private offline backup of `GlobalSportsID-FullBackup`.

## App Identity

- Confirm app name is correct in `app.json`.
- Confirm iOS bundle ID is `com.globalsportsid.app`.
- Confirm Android package is `com.globalsportsid.app`.
- Confirm app icon and splash assets are final.

## Account Flows

- Test player registration.
- Test coach registration.
- Confirm registration logs users straight in.
- Confirm wrong account type cannot log in through the wrong entry path.
- Confirm required fields validation works.
- Confirm image upload works.

## Sport Separation

- Confirm players only see their selected sport.
- Confirm coaches only see their selected sport.
- Confirm filters only show positions for the selected sport.
- Confirm trials and offers are scoped by sport.
- Confirm cross-sport contact is blocked.

## Messaging

- Test player to coach request flow.
- Test coach to player direct contact flow.
- Test player to player direct chat flow.
- Confirm accepted requests create a reusable conversation.
- Confirm repeat contact does not create duplicate conversations.
- Confirm unread badge and unread markers work.
- Confirm opening a conversation marks messages as read.

## Profiles

- Confirm player gender appears on cards and profiles.
- Confirm player stats do not auto-fill fake values.
- Confirm highlight video opens the saved link.
- Confirm editing profile saves correctly.
- Confirm coach photo edit only appears on the top avatar circle.

## Device Testing

- Test on Android emulator.
- Test on a real phone.
- Test web build for layout sanity.
- Test after logout and fresh login.
- Test after app restart.

## Store Prep

- Create production builds with EAS.
- Prepare store descriptions, screenshots, and privacy details.
- Review app permissions before submission.
- Test the production build, not only Expo preview.

## After Launch

- Monitor Supabase auth and database errors.
- Keep GitHub and offline backups updated after each major change.
- Tag release versions in git.
