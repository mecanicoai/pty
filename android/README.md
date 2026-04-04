# Android Studio Skeleton

This directory contains an Android Studio project skeleton for wrapping the Mecánico web app in a native WebView.

## Included

- app module with manifest and resources
- WebView host activity
- JavaScript bridge matching the web app contract
- Play Integrity bootstrap skeleton
- native speech and attachment controller skeletons

## Not Yet Fully Implemented

- final backend networking
- full Play Integrity provider wiring
- real attachment picker Activity Result flow
- runtime permission UX

## Open In Android Studio

1. Open the `android/` directory in Android Studio.
2. Set `local.properties` with your Android SDK path.
3. Update `BuildConfig.MECANICO_BASE_URL` in `app/build.gradle.kts` if needed.
4. Wire the TODO sections in:
   - `integration/BackendApi.kt`
   - `integration/PlayIntegrityManager.kt`
   - `media/PickerController.kt`
   - `integration/InstallBootstrapCoordinator.kt`

## JS Bridge Contract

Native methods exposed to WebView:

- `window.MecanicoAndroid.startVoiceInput(language)`
- `window.MecanicoAndroid.stopVoiceInput()`
- `window.MecanicoAndroid.pickAttachments(accept, multiple, maxFiles)`

Callbacks into web app:

- `window.MecanicoWebApp.receiveVoiceTranscript(...)`
- `window.MecanicoWebApp.setVoiceRecording(...)`
- `window.MecanicoWebApp.receiveAttachments(...)`
- `window.MecanicoWebApp.receiveBridgeError(...)`
- `window.MecanicoWebApp.setInstallToken(token, expiresAt)`
