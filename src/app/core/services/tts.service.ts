import { Injectable } from '@angular/core';
import { Observable, from, timer, of, defer } from 'rxjs';
import { map, switchMap, first, shareReplay, catchError } from 'rxjs/operators';
import { TextToSpeech, SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';

@Injectable({
  providedIn: 'root'
})
export class TtsService {

  /** Récupère la liste des voix TTS disponibles (polls toutes les 1s jusqu'à obtenir une réponse). */
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

  /** Ouvre les paramètres d'installation TTS du système. */
  openInstall(): Observable<void> {
    return defer(() => TextToSpeech.openInstall());
  }

  /** Prononce un texte avec la voix sélectionnée. Retourne un observable qui se complète à la fin de l'énoncé. */
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

  /** Stoppe immédiatement la lecture en cours. */
  arreterLecture(): Observable<void> {
    return defer(() => TextToSpeech.stop());
  }
}
