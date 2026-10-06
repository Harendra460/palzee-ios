# PalZee

One Expo (SDK 54) codebase for the PalZee iOS and Android apps. Setlog-style private groups ("PAls")
where everyone logs a short clip every hour; the day resets at 4 AM and each day replays as a
split-screen recap.

Both platforms share one Supabase project and the same backend contracts as the original native
Android app (`com.finrein.pals`): tables `pals`, `user_pals`, `submissions`, `messages`, the
`get_clean_homescreen_dashboard` RPC, storage buckets `pals` / `pals_vlogs` / `avatars`, and the
`send-hourly-pal` FCM topic pushes. Wire formats live in `services/encoding.ts`.

## Run

```bash
npm install
npx expo run:android   # generates android/ with prebuild, then builds
npx expo run:ios       # uses the committed ios/ project
```

`android/` is generated (Continuous Native Generation) from `app.json`, `app.config.js`, `plugins/`
and `modules/`; it is git-ignored. `ios/` is committed because it carries the native
`VideoExporter` and app delegate customisations, so after changing native dependencies run
`cd ios && pod install`.

Android Gradle needs JDK 17 (`JAVA_HOME=$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home`).

## Configuration

Copy `.env.example` to `.env`.

| What | Where | Needed for |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `.env` / EAS env | Everything (defaults to the current project) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | `.env` / EAS env | Native Google sign-in on Android (otherwise browser OAuth is used) |
| `google-services.json` for `com.finrein.pals` | project root, or EAS file env var `GOOGLE_SERVICES_JSON` | Android push (FCM topics). Without it the app builds and runs, reminders are just unavailable |

### Supabase dashboard

- **Auth → URL Configuration → Redirect URLs:** add `io.supabase.pals://login-callback`
  (browser OAuth, email confirmation and password-reset links).
- **Auth → Providers:** enable Google (web client ID + secret) and Apple (Services ID, key) for the
  sign-in buttons. Email is used for password and one-time-code sign-in.
- **Realtime:** enable it for `pals`, `user_pals`, `submissions`, `messages`.

### Platform notes

- **iOS push** is not wired yet: it needs an APNs key in Firebase, a `GoogleService-Info.plist`, and
  `@react-native-firebase` linked for iOS (it is excluded in `package.json → expo.autolinking.ios`).
- **Sign in with Apple** is enabled in `ios/Palzee/Palzee.entitlements`; the App ID needs the
  capability turned on in the Apple Developer portal before device/TestFlight builds.
- **Play Store:** the package is `com.finrein.pals`, so releases must be signed with the existing
  upload key to update the current listing.

## Layout

```
app/            expo-router screens: (onboarding), (tabs), camera, pal/[code], chat/[code], recap/[code]
components/pz   design system primitives (tokens in theme/tokens.ts)
components/moments  clip thumbnails, playback, feed card
services/       Supabase data layer (auth, pals, moments + upload queue, chat, realtime, push, storage)
stores/         app state (zustand)
modules/video-exporter  Android Media3 port of ios/Palzee/VideoExporter.swift (same JS API)
plugins/        config plugins (launcher icons, FCM manifest overrides)
```
