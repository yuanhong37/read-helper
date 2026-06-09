# ReadHelper — AGENTS.md

## Quick start

```bash
npm install
ng serve              # dev server at http://localhost:4200
ng build              # build to dist/read-helper
ng test               # Karma + Jasmine unit tests
```

## Architecture

- **Single Angular module** (`AppModule`) — no routing, no lazy loading.
- **`src/app/core/services/`** — three services: `ocr-speech.service.ts` (implemented), `camera.services.ts` and `tts.service.ts` (both empty stubs).
- **`src/app/features/scanner/`** — empty; reserved for future feature modules.
- **Entry point**: `src/main.ts` → `AppModule` → `AppComponent`.

The app is a photo → OCR → TTS pipeline:
1. `Camera.getPhoto()` (Capacitor Camera)
2. `tesseract.js` with `'fra'` language (French OCR)
3. `TextToSpeech.speak()` with `lang: 'fr-FR'`

## Framework & toolchain quirks

- **Capacitor 8** (Android): `android/` directory is native platform output. Rebuild web assets then sync:
  ```bash
  ng build
  npx cap sync android
  npx cap open android
  ```
- **tesseract.js** is a CommonJS dependency — listed in `angular.json` → `allowedCommonJsDependencies` to avoid build warnings.
- **SCSS** is the default style language (configured in `angular.json`).
- **TypeScript strict mode** is on (`strict: true` in tsconfig.json).
- **app.component.spec.ts** test is outdated — references `.content span` selector that no longer exists in the template. Don't trust it as source of truth for current layout.

## Code conventions

- Single quotes for TypeScript (`.editorconfig`).
- 2-space indentation.
- `providedIn: 'root'` for services.

## Capacitor commands summary

```bash
ng build && npx cap sync android   # sync web build to Android
npx cap open android                # open in Android Studio
npx cap run android                 # run on device/emulator
```

## Testing

```bash
ng test --watch=false               # single run (CI)
ng test --browsers=ChromeHeadless   # headless (no UI needed)
```
