import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { CameraService } from '../../../core/services/camera.services';
import { OcrSpeechService } from '../../../core/services/ocr-speech.service';
import { TtsService } from '../../../core/services/tts.service';

enum LectureMode {
  Full = 'full',
  Sentence = 'sentence',
}

const DELAI_MOT_MS = 80;
const DELAI_MOT_BASE_MS = 300;
const DELAI_PHRASE_MS = 50;
const DELAI_PHRASE_BASE_MS = 500;

@Component({
  selector: 'app-ocr-speech',
  templateUrl: './ocr-speech.component.html',
  styleUrls: ['./ocr-speech.component.scss']
})
export class OcrSpeechComponent implements OnInit, OnDestroy {
  LectureMode = LectureMode;
  imageAffichee: string | undefined = '';
  texteExtrait: string = '';
  enCoursDeChargement: boolean = false;
  enCoursDeLecture: boolean = false;
  toutesLesVoix: SpeechSynthesisVoice[] = [];
  voixDisponibles: SpeechSynthesisVoice[] = [];
  voixSelectionnee: number = 0;
  motActifIndex: number | null = null;
  modeLecture: LectureMode = LectureMode.Full;
  phraseActiveeIndex: number | null = null;
  private destroy$ = new Subject<void>();

  get mots(): { texte: string; estMot: boolean }[] {
    if (!this.texteExtrait) return [];
    const parties = this.texteExtrait.split(/(\s+)/);
    return parties.map(p => ({ texte: p, estMot: /[a-zA-ZÀ-ÿ]/.test(p) }));
  }

  get phrases(): string[] {
    if (!this.texteExtrait) return [];
    return this.texteExtrait.split(/(?<=[.!?])\s+/).filter(p => p.trim().length > 0);
  }

  constructor(
    private cameraService: CameraService,
    private ocrService: OcrSpeechService,
    private ttsService: TtsService,
  ) {}

  ngOnInit() {
    this.ttsService.getVoices$().pipe(
      takeUntil(this.destroy$),
    ).subscribe(voices => {
      this.toutesLesVoix = voices;
      this.voixDisponibles = voices.filter(v =>
        v.lang.toLowerCase().startsWith('fr') && (v.lang.toLowerCase() === 'fr-fr')
      );
      if (this.voixDisponibles.length > 0) {
        const firstIdx = voices.indexOf(this.voixDisponibles[0]);
        this.voixSelectionnee = firstIdx >= 0 ? firstIdx : 0;
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  surChangementVoix(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.voixSelectionnee = parseInt(select.value, 10);
  }

  async lancerLeScan() {
    try {
      this.enCoursDeChargement = true;
      this.enCoursDeLecture = false;
      this.modeLecture = LectureMode.Full;
      this.motActifIndex = null;
      this.phraseActiveeIndex = null;

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
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
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
    }, motPropre.length * DELAI_MOT_MS + DELAI_MOT_BASE_MS);
  }

  changerMode(mode: LectureMode) {
    this.modeLecture = mode;
    this.arreterLaLecture();
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
  }

  async prononcerPhrase(phrase: string, index: number) {
    await this.ttsService.arreterLecture();
    if(this.enCoursDeLecture) {
      this.enCoursDeLecture = false;
      this.phraseActiveeIndex = null;
      return;
    }
    this.enCoursDeLecture = true;
    this.phraseActiveeIndex = index;
    const phrasePropre = phrase.trim();
    if (phrasePropre) {
      await this.ttsService.lireTexte(phrasePropre, this.voixSelectionnee);
    }
    setTimeout(() => {
      this.phraseActiveeIndex = null;
    }, phrasePropre.length * DELAI_PHRASE_MS + DELAI_PHRASE_BASE_MS);
  }
}
