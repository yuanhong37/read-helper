import { Component } from '@angular/core';
import { OcrSpeechService } from '../app/core/services/ocr-speech.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  imageAffichee: string | undefined = '';
  texteExtrait: string = '';
  enCoursDeChargement: boolean = false;

  constructor(private ocrSpeech: OcrSpeechService) {}

  async lancerLeScan() {
    try {
      this.enCoursDeChargement = true;

      // Étape 1 : Photo
      this.imageAffichee = await this.ocrSpeech.prendrePhoto();
      if (!this.imageAffichee) return;

      // Étape 2 : OCR
      this.texteExtrait = await this.ocrSpeech.extraireTexte(this.imageAffichee);

      // Étape 3 : Lecture
      await this.ocrSpeech.lireTexte(this.texteExtrait);

    } catch (error) {
      console.error("Erreur lors du processus :", error);
    } finally {
      this.enCoursDeChargement = false;
    }
  }
}
