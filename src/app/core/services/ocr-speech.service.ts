import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';
import { Ocr, RecognitionResult } from '@jcesarmobile/capacitor-ocr';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class OcrSpeechService {

  async extraireTexte(imageSrc: string): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      const result = await Ocr.process({ image: imageSrc });
      return result.results.map(r => r.text).join('\n');
    }

    const worker = await createWorker('fra');
    const ret = await worker.recognize(imageSrc);
    await worker.terminate();
    return ret.data.text;
  }
}
