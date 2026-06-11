import { Injectable } from '@angular/core';
import { Observable, defer } from 'rxjs';
import { map } from 'rxjs/operators';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

@Injectable({
  providedIn: 'root'
})
export class CameraService {

  /** Ouvre l'appareil photo (galerie sur web) et retourne l'image en DataUrl. */
  prendrePhoto(): Observable<string | undefined> {
    return defer(() =>
      Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: Capacitor.isNativePlatform() ? CameraSource.Prompt : CameraSource.Photos,
      }),
    ).pipe(
      map(image => image.dataUrl),
    );
  }
}
