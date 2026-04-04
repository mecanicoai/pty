# Android Wrapper Spec

This document defines the native Android wrapper expected by the current web app.

## Goal

Wrap the Next.js Mecánico app in an Android WebView and provide:

- Play Integrity bootstrap
- signed install token injection
- native speech fallback
- native attachment picking

The web app already supports these bridge methods:

- `window.MecanicoAndroid.startVoiceInput(language)`
- `window.MecanicoAndroid.stopVoiceInput()`
- `window.MecanicoAndroid.pickAttachments(accept, multiple, maxFiles)`

The native app returns data through:

- `window.MecanicoWebApp.receiveVoiceTranscript(payload)`
- `window.MecanicoWebApp.setVoiceRecording(recording)`
- `window.MecanicoWebApp.receiveAttachments(payload)`
- `window.MecanicoWebApp.receiveBridgeError(payload)`
- `window.MecanicoWebApp.setInstallToken(token, expiresAt)`

## Native Architecture

Recommended classes:

- `MainActivity`
- `MecanicoAndroidBridge`
- `SpeechController`
- `PickerController`
- `InstallBootstrapCoordinator`
- `PlayIntegrityManager`
- `BackendApi`

## Startup Flow

1. Native loads or creates `installId`
2. Native calls `POST /api/install`
3. If token is returned:
   - load WebView
   - inject token with `setInstallToken`
4. If integrity challenge is returned:
   - request Play Integrity using returned `requestHash`
   - call `POST /api/integrity/verify`
   - inject returned token
5. Web app then uses `/api/chat`

## Attachment Contract

The web app expects an array shaped like:

```json
[
  {
    "name": "foto.jpg",
    "mimeType": "image/jpeg",
    "kind": "image",
    "dataBase64": "..."
  }
]
```

Rules:

- `kind = "image"` when MIME starts with `image/`
- otherwise `kind = "file"`
- max 4 files
- max 8MB per file before base64 conversion

## Speech Contract

Native speech should call:

```javascript
window.MecanicoWebApp.receiveVoiceTranscript("texto final")
window.MecanicoWebApp.setVoiceRecording(true)
window.MecanicoWebApp.setVoiceRecording(false)
window.MecanicoWebApp.receiveBridgeError({ message: "No se pudo capturar audio." })
```

## Permissions

Required:

- `INTERNET`
- `RECORD_AUDIO`

Optional:

- `CAMERA`

## Manifest Notes

Use a WebView activity with:

- JavaScript enabled
- DOM storage enabled
- content access enabled
- file access disabled unless strictly required

## Review Checklist

- Play Integrity license verification succeeds for a real paid install
- invalid or expired install token blocks `/api/chat`
- mic permission denial is handled cleanly
- image pick works
- PDF/doc pick works
- native transcript appears in the web composer
- token reinjection works after app restart
