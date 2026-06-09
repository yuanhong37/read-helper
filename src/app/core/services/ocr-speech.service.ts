import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { TextToSpeech, SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { createWorker } from 'tesseract.js';

@Injectable({
  providedIn: 'root'
})
export class OcrSpeechService {

  constructor() { }

  // 1. Prendre la photo
  async prendrePhoto(): Promise<string | undefined> {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl, // On récupère en Base64/DataUrl pour Tesseract
      source: CameraSource.Camera // Ouvre directement l'appareil photo
    });

    return image.dataUrl;
  }

  // 2. Extraire le texte en Français
  async extraireTexte(imageSrc: string): Promise<string> {
    // Crée un travailleur Tesseract avec la langue française
    const worker = await createWorker('fra');
    const ret = await worker.recognize(imageSrc);
    await worker.terminate();

    return ret.data.text;
  }

  // 3. Récupérer les voix disponibles
  async getVoices(): Promise<SpeechSynthesisVoice[]> {
    const { voices } = await TextToSpeech.getSupportedVoices();
    return voices;
  }

  // 4. Lire le texte avec une voix française
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

  // 5. Arrêter la lecture
  async arreterLecture(): Promise<void> {
    await TextToSpeech.stop();
  }
}
