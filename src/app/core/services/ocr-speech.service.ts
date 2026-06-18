import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Ocr } from '@jcesarmobile/capacitor-ocr';
import { createWorker, PSM } from 'tesseract.js';
import { Observable, defer, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class OcrSpeechService {
  extraireTexte(imageSrc: string): Observable<string> {
    return this.preparerImage(imageSrc).pipe(
      switchMap(processedSrc => {
        if (Capacitor.isNativePlatform()) {
          return defer(() => Ocr.process({ image: processedSrc })).pipe(
            map(result => result.results.map(r => r.text).join('\n')),
          );
        }

        return defer(() => createWorker('fra')).pipe(
          switchMap(worker =>
            from(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })).pipe(
              switchMap(() =>
                from(worker.recognize(processedSrc)).pipe(
                  map((ret: any) => ret.data.text),
                  switchMap(text =>
                    from(worker.terminate()).pipe(map(() => text)),
                  ),
                ),
              ),
            ),
          ),
        );
      }),
    );
  }

  private preparerImage(src: string): Observable<string> {
    return defer(() => {
      const img = new Image();
      return from(new Promise<string>((resolve, reject) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const v = gray > 128 ? 255 : 0;
            data[i] = data[i + 1] = data[i + 2] = v;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = reject;
        img.src = src;
      }));
    });
  }
}
