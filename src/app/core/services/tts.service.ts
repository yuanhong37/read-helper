import { Injectable } from '@angular/core';
import { TextToSpeech, SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';

@Injectable({
  providedIn: 'root'
})
export class TtsService {

  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    const { voices } = await TextToSpeech.getSupportedVoices();
    return voices;
  }

  async lireTexte(texte: string, voice?: number): Promise<void> {
    if (!texte || texte.trim() === '') return;

    await TextToSpeech.speak({
      text: texte,
      lang: 'fr-FR',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
      voice,
    });
  }

  async arreterLecture(): Promise<void> {
    await TextToSpeech.stop();
  }
}
