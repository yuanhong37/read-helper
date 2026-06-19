import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorPluginMlKitTextRecognition } from '@pantrist/capacitor-plugin-ml-kit-text-recognition';
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
          const base64 = processedSrc.includes('base64,')
            ? processedSrc.split('base64,')[1]
            : processedSrc;
          return defer(() =>
            CapacitorPluginMlKitTextRecognition.detectText({ base64Image: base64, rotation: 0 })
          ).pipe(
            map(result => result.text),
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
    if (Capacitor.isNativePlatform()) {
      return defer(() => Promise.resolve(src));
    }

    return defer(() => {
      const img = new Image();
      return from(new Promise<string>((resolve, reject) => {
        img.onload = () => {
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w < 2000) {
            const scale = 2000 / w;
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
        img.onerror = reject;
        img.src = src;
      }));
    });
  }
}
