import { Component, OnInit } from '@angular/core';
import { SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { CameraService } from '../../../core/services/camera.services';
import { OcrSpeechService } from '../../../core/services/ocr-speech.service';
import { TtsService } from '../../../core/services/tts.service';

@Component({
  selector: 'app-ocr-speech',
  templateUrl: './ocr-speech.component.html',
  styleUrls: ['./ocr-speech.component.scss']
})
export class OcrSpeechComponent implements OnInit {
  imageAffichee: string | undefined = '';
  texteExtrait: string = '';
  enCoursDeChargement: boolean = false;
  enCoursDeLecture: boolean = false;
  toutesLesVoix: SpeechSynthesisVoice[] = [];
  voixDisponibles: SpeechSynthesisVoice[] = [];
  voixSelectionnee: number = 0;
  motActifIndex: number | null = null;

  get mots(): { texte: string; estMot: boolean }[] {
    if (!this.texteExtrait) return [];
    const parties = this.texteExtrait.split(/(\s+)/);
    return parties.map(p => ({ texte: p, estMot: /[a-zA-ZÀ-ÿ]/.test(p) }));
  }

  constructor(
    private cameraService: CameraService,
    private ocrService: OcrSpeechService,
    private ttsService: TtsService,
  ) {}

  async ngOnInit() {
    this.toutesLesVoix = await this.ttsService.getVoices();
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

      this.imageAffichee = await this.cameraService.prendrePhoto();
      if (!this.imageAffichee) return;

      this.texteExtrait = await this.ocrService.extraireTexte(this.imageAffichee);

    } catch (error) {
      console.error('Erreur lors du processus :', error);
    } finally {
      this.enCoursDeChargement = false;
    }
  }

  async lireLeTexte() {
    this.enCoursDeLecture = true;
    await this.ttsService.lireTexte(this.texteExtrait, this.voixSelectionnee);
  }

  async arreterLaLecture() {
    await this.ttsService.arreterLecture();
    this.enCoursDeLecture = false;
  }

  async prononcerMot(mot: string, index: number) {
    await this.ttsService.arreterLecture();
    this.enCoursDeLecture = false;
    this.motActifIndex = index;
    const motPropre = mot.replace(/[^a-zA-ZÀ-ÿ'-]/g, '');
    if (motPropre) {
      await this.ttsService.lireTexte(motPropre, this.voixSelectionnee);
    }
    setTimeout(() => {
      this.motActifIndex = null;
    }, motPropre.length * 80 + 300);
  }
}
