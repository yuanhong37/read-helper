import { Component, OnInit } from '@angular/core';
import { SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { OcrSpeechService } from '../app/core/services/ocr-speech.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  imageAffichee: string | undefined = '';
  texteExtrait: string = '';
  enCoursDeChargement: boolean = false;
  enCoursDeLecture: boolean = false;
  toutesLesVoix: SpeechSynthesisVoice[] = [];
  voixDisponibles: SpeechSynthesisVoice[] = [];
  voixSelectionnee: number = 0;

  constructor(private ocrSpeech: OcrSpeechService) {}

  async ngOnInit() {
    this.toutesLesVoix = await this.ocrSpeech.getVoices();
    this.voixDisponibles = this.toutesLesVoix.filter(v =>
      v.lang.toLowerCase().startsWith('fr')
    );
    if (this.voixDisponibles.length > 0) {
      const firstIdx = this.toutesLesVoix.indexOf(this.voixDisponibles[0]);
      this.voixSelectionnee = firstIdx >= 0 ? firstIdx : 0;
    }
  }

  surChangementVoix(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.voixSelectionnee = parseInt(select.value, 10);
  }

  async lancerLeScan() {
    try {
      this.enCoursDeChargement = true;
      this.enCoursDeLecture = false;

      this.imageAffichee = await this.ocrSpeech.prendrePhoto();
      if (!this.imageAffichee) return;

      this.texteExtrait = await this.ocrSpeech.extraireTexte(this.imageAffichee);

    } catch (error) {
      console.error("Erreur lors du processus :", error);
    } finally {
      this.enCoursDeChargement = false;
    }
  }

  async lireLeTexte() {
    this.enCoursDeLecture = true;
    await this.ocrSpeech.lireTexte(this.texteExtrait, this.voixSelectionnee);
  }

  async arreterLaLecture() {
    await this.ocrSpeech.arreterLecture();
    this.enCoursDeLecture = false;
  }
}
