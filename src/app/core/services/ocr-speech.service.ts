import { Injectable } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { createWorker } from 'tesseract.js';
import { Ocr } from '@jcesarmobile/capacitor-ocr';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class OcrSpeechService {

  extraireTexte(imageSrc: string): Observable<string> {
    if (Capacitor.isNativePlatform()) {
      return defer(() => Ocr.process({ image: imageSrc })).pipe(
        map(result => result.results.map(r => r.text).join('\n')),
      );
    }

    return defer(() => createWorker('fra')).pipe(
      switchMap(worker =>
        from(worker.recognize(imageSrc)).pipe(
          map((ret: any) => ret.data.text),
          switchMap(text =>
            from(worker.terminate()).pipe(map(() => text)),
          ),
        ),
      ),
    );
  }
}
