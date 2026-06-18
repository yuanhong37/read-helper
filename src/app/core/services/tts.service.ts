import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { TextToSpeech, SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { Observable, defer, from, of, timer } from 'rxjs';
import { catchError, first, map, shareReplay, switchMap, tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TtsService {
  getVoices$(): Observable<SpeechSynthesisVoice[]> {
    return timer(0, 1000).pipe(
      switchMap(() => from(TextToSpeech.getSupportedVoices()
        .catch(() => TextToSpeech.getSupportedLanguages())
        .catch(() => ({ languages: [] })),
      )),
      map(r => {
        const data = r as any;
        if (data?.voices?.length) {
          return data.voices as SpeechSynthesisVoice[];
        }
        const langs = data?.languages as string[] ?? [];
        return langs.map(l => ({
          name: l,
          lang: l,
          voiceURI: l,
          default: false,
          localService: true,
        })) as SpeechSynthesisVoice[];
      }),
      first(voices => voices.length > 0),
      shareReplay(1),
    );
  }

  openInstall(): Observable<void> {
    return defer(() => TextToSpeech.openInstall());
  }

  lireTexte(texte: string, voice?: number): Observable<void> {
    if (!texte || texte.trim() === '') return of(undefined);

    return defer(() =>
      TextToSpeech.speak({
        text: texte,
        lang: 'fr-FR',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
        voice,
      }),
    );
  }

  arreterLecture(): Observable<void> {
    return defer(() => TextToSpeech.stop());
  }

  getSavedVoice$(): Observable<number> {
    return defer(() =>
      Preferences.get({ key: 'voix-selectionnee' }).then(({ value }) =>
        value ? parseInt(value, 10) : 0,
      ),
    );
  }

  saveVoice(index: number): Observable<void> {
    return defer(() =>
      Preferences.set({ key: 'voix-selectionnee', value: String(index) }),
    );
  }
}
