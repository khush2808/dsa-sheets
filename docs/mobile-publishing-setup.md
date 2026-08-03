# Mobile Setup & Publishing Guide: Expo, Indus Appstore & Google Play

A comprehensive guide for configuring, testing, building, and publishing the **DSA Sheets** React Native mobile app to **Indus Appstore** and **Google Play Store**.

---

## 1. Expo Account & EAS CLI Setup

### A. Create an Expo Account
1. Go to [https://expo.dev](https://expo.dev) and sign up for a free account.
2. Verify your email address.

### B. Install & Authenticate EAS CLI
In your terminal, run:
```bash
npm install -g eas-cli
eas login
```
*Verify login status anytime with `eas whoami`.*

### C. Build Configuration (`eas.json`)
The project includes a pre-configured [`mobile-app/eas.json`](file:///c:/Users/khush/dsa-sheets/mobile-app/eas.json) set to generate direct `.apk` and `.aab` installers for Android:
- **`preview` profile**: Generates an `.apk` file for testing on physical devices or emulator without uploading to store.
- **`production` profile**: Generates a production `.apk` or `.aab` ready for Indus Appstore or Google Play Store.

To trigger an Android APK build in Expo Cloud:
```bash
cd mobile-app
eas build -p android --profile production
```

---

## 2. Indus Appstore Publishing Setup

Indus Appstore (by PhonePe) is India's free Android App Store. Registration and app hosting are 100% free with 0% developer commission fees.

### A. Developer Account Registration
1. Visit [Indus Appstore Developer Console](https://developer.indusappstore.com/).
2. Sign up using your phone number / email.
3. Complete **KYC Verification**:
   - For Individual Developers: PAN Card details & Aadhaar verification.
   - For Businesses: GSTIN & Company PAN.

### B. Developer Profile Details
Fill in:
- Developer Name
- Support Email
- Privacy Policy URL: [https://dsa-sheets.vercel.app/privacy/](https://dsa-sheets.vercel.app/privacy/)

### C. App Asset & Metadata Requirements
To submit your app on Indus Appstore, prepare:
1. **App Package**: The `.apk` or `.aab` file built with `eas build -p android --profile production`.
2. **App Icon**: `512 x 512 px` (PNG format). *Saved at [`mobile-app/assets/images/icon.png`](file:///c:/Users/khush/dsa-sheets/mobile-app/assets/images/icon.png)*.
3. **Feature Graphic**: `1024 x 500 px` (PNG format banner).
4. **Phone Screenshots**: Minimum 2 phone screenshots (portrait 9:16 aspect ratio).
5. **App Information**:
   - **Title**: DSA Sheets Tracker (max 30 characters)
   - **Short Description**: Clean, fast UI for Striver & NeetCode DSA problem sheets (max 80 characters)
   - **Full Description**: Detailed features, problem sheets, filtering, notes, offline tracking (max 4000 characters)
   - **Category**: Education / Tools

---

## 3. Google Play Store Setup (Optional / Comparison)

| Requirement | Indus Appstore | Google Play Store |
| :--- | :--- | :--- |
| **Registration Fee** | Free ($0) | $25 USD (One-time) |
| **Commission Fee** | 0% | 15% - 30% |
| **Binary Format** | `.apk` or `.aab` | `.aab` (Android App Bundle) |
| **Verification** | PAN / Aadhaar KYC | Government ID / DUNS number |
| **Review Time** | ~24-48 Hours | ~3-7 Days |

### Steps to Publish on Google Play:
1. Register at [Google Play Console](https://play.google.com/console).
2. Pay the $25 one-time developer registration fee.
3. Verify Developer Identity (ID card / Passport).
4. Build `.aab` bundle: `eas build -p android --profile production`.
5. Complete **Data Safety** questionnaire in Play Console and submit for review.

---

## 4. Local Testing & Debugging (Android Phone / Emulator)

### A. Testing on Physical Android Phone via Expo Go
1. Install **Expo Go** from Google Play Store on your Android phone.
2. In terminal:
   ```bash
   cd mobile-app
   npx expo start
   ```
3. Scan the generated QR code using the Expo Go app.

### B. Testing on Android Emulator
1. Install **Android Studio** and set up an Android Virtual Device (AVD).
2. Run `npx expo start` and press `a` to open in Android Emulator.

### C. Debugging Commands
- **Metro Logs**: View live JavaScript logs directly in terminal.
- **Fast Refresh**: Edits in React components update live on-device immediately.
- **ADB Logcat**: Run `adb logcat *:E` to inspect native crash stack traces.
