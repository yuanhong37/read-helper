# ReadHelper — AGENTS.md

## Quick start

```bash
npm install
ng serve              # dev server at http://localhost:4200
ng build              # build to dist/read-helper
npm test              # Jest unit tests
```

## Architecture

- **Standalone components** (no `AppModule`) — `bootstrapApplication` in `main.ts`.
- **Entry point**: `src/main.ts` → `AppComponent` (shell) → `OcrSpeechComponent`.
- **`OcrSpeechComponent`** at `src/app/features/ocr-speech/` owns all UI (scan button, voice selector, image preview, read/stop buttons).
- **`AppComponent`** is a minimal shell — just renders `<app-ocr-speech>`.
- **Three single-responsibility services** in `src/app/core/services/`:
  | Service | Responsibility |
  |---|---|
  | `CameraService` | `prendrePhoto()` → `Camera.getPhoto()` |
  | `OcrSpeechService` | `extraireTexte()` → tesseract.js OCR with `'fra'` |
  | `TtsService` | `getVoices()`, `lireTexte()`, `arreterLecture()` → `TextToSpeech` |

The app is a photo → OCR → TTS pipeline:
1. `Camera.getPhoto()` (Capacitor Camera)
2. `tesseract.js` with `'fra'` language (French OCR)
3. `TextToSpeech.speak()` with `lang: 'fr-FR'`

Users select a specific TTS voice from the dropdown (filtered to French) for more natural output.

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
- **Standalone components** — all components use `inject()` instead of constructor DI.
- **New Angular control flow** — `@if`/`@for` instead of `*ngIf`/`*ngFor`.
- **Signals** — not used yet; plain fields remain.

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
npm test                    # single run (CI) — Jest
npm run test:watch          # watch mode
npm run test:coverage       # with coverage
```
