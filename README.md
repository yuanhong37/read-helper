# ReadHelper

Application Angular (Capacitor + Android) qui transforme une photo en texte par OCR, puis le lit à voix haute via la synthèse vocale.

## Pipeline

1. **Photo** — `CameraService` capture une image via `Camera.getPhoto()`
2. **OCR** — `OcrSpeechService` extrait le texte avec tesseract.js (langue `fra`)
3. **Synthèse** — `TtsService` lit le texte avec `TextToSpeech.speak()` (voix française)

L'utilisateur peut choisir la voix parmi les voix françaises disponibles.

## Prérequis

- Node.js
- Angular CLI
- Android Studio (pour le déploiement mobile)

## Installation

```bash
npm install
```

## Développement

```bash
ng serve          # Serveur local → http://localhost:4200
ng build          # Build vers dist/read-helper
ng test           # Tests unitaires (Karma + Jasmine)
```

## Déploiement Android

```bash
ng build && npx cap sync android
npx cap open android    # Ouvrir dans Android Studio
npx cap run android     # Lancer sur appareil/émulateur
```

## Structure

```
src/
├── app/
│   ├── core/
│   │   └── services/
│   │       ├── camera.services.ts        # Capture photo (Capacitor)
│   │       ├── ocr-speech.service.ts     # OCR avec tesseract.js
│   │       ├── tts.service.ts            # Synthèse vocale (TextToSpeech)
│   │       └── vocabulaire.service.ts    # Gestion du vocabulaire
│   ├── features/
│   │   ├── ocr-speech/                   # Scan, OCR et lecture
│   │   ├── historique/                   # Historique des sessions
│   │   └── vocabulaire/                  # Mots et expressions sauvegardés
│   ├── app.component.ts                  # Composant racine
│   ├── app.module.ts                     # Module Angular unique
│   └── app-routing.module.ts             # Routage (lecture, historique, vocabulaire)
├── index.html
├── main.ts                               # Point d'entrée
└── styles.scss                           # Styles globaux
```
