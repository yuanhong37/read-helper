import { Injectable } from '@angular/core';
import { createWorker } from 'tesseract.js';

@Injectable({
  providedIn: 'root'
})
export class OcrSpeechService {

  async extraireTexte(imageSrc: string): Promise<string> {
    const worker = await createWorker('fra');
    const ret = await worker.recognize(imageSrc);
    await worker.terminate();

    return ret.data.text;
  }
}
