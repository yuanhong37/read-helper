import { Component, OnDestroy, OnInit } from '@angular/core';
import { SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { Observable, Subject, of, timer } from 'rxjs';
import { catchError, filter, finalize, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { LectureMode } from '../../core/model/lecture-mode.enum';
import { CameraService } from '../../core/services/camera.services';
import { OcrSpeechService } from '../../core/services/ocr-speech.service';
import { TtsService } from '../../core/services/tts.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

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
  texteExtrait = '';
  enCoursDeChargement = false;
  enCoursDeLecture = false;
  toutesLesVoix: SpeechSynthesisVoice[] = [];
  voixDisponibles: SpeechSynthesisVoice[] = [];
  voixSelectionnee = 0;
  motActifIndex: number | null = null;
  modeLecture: LectureMode = LectureMode.Full;
  phraseActiveeIndex: number | null = null;
  motsSauvegardes: Set<string> = new Set();

  private destroy$ = new Subject<void>();
  private longPressTimer: any = null;
  private longPressDetected = false;

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
    private vocabulaireService: VocabulaireService,
  ) {}

  ngOnInit() {
    this.vocabulaireService.getMots().pipe(takeUntil(this.destroy$)).subscribe(mots => {
      this.motsSauvegardes = new Set(mots.map(m => m.mot.toLowerCase()));
    });

    this.vocabulaireService.chargerTexteActif().pipe(takeUntil(this.destroy$)).subscribe(texte => {
      if (texte) this.texteExtrait = texte;
    });

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

  lancerLeScan() {
    this.enCoursDeChargement = true;
    this.enCoursDeLecture = false;
    this.modeLecture = LectureMode.Full;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;

    this.cameraService.prendrePhoto().pipe(
      switchMap(src => {
        if (!src) return of(null);
        this.imageAffichee = src;
        return this.ocrService.extraireTexte(src).pipe(
          tap(texte => this.texteExtrait = texte),
          switchMap(texte =>
            this.vocabulaireService.ajouterTexteHistorique(texte).pipe(
              switchMap(() => this.vocabulaireService.sauvegarderTexteActif(texte)),
            ),
          ),
        );
      }),
      catchError(error => {
        console.error('Erreur lors du processus :', error);
        return of(undefined);
      }),
      finalize(() => this.enCoursDeChargement = false),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  lireLeTexte() {
    this.enCoursDeLecture = true;
    this.ttsService.lireTexte(this.texteExtrait, this.voixSelectionnee).pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  arreterLaLecture() {
    this.enCoursDeLecture = false;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
    this.ttsService.arreterLecture().pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  prononcerMot(mot: string, index: number) {
    const motPropre = mot.replace(/[^a-zA-ZÀ-ÿ'-]/g, '');
    const delai = motPropre.length * DELAI_MOT_MS + DELAI_MOT_BASE_MS;

    this.ttsService.arreterLecture().pipe(
      tap(() => {
        this.enCoursDeLecture = false;
        this.motActifIndex = index;
      }),
      switchMap(() => motPropre ? this.ttsService.lireTexte(motPropre, this.voixSelectionnee) : of(undefined)),
      switchMap(() => timer(delai)),
      tap(() => { this.motActifIndex = null; }),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  onPointerDown(part: { texte: string }, index: number) {
    this.longPressDetected = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressDetected = true;
      this.sauvegarderMot(part);
    }, 500);
  }

  onPointerUp(part: { texte: string }, index: number) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (!this.longPressDetected) {
      this.prononcerMot(part.texte, index);
    }
  }

  onPointerCancel() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressDetected = false;
  }

  changerMode(mode: LectureMode) {
    this.modeLecture = mode;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
    this.ttsService.arreterLecture().pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  prononcerPhrase(phrase: string, index: number) {
    const phrasePropre = phrase.trim();
    const etaitEnLecture = this.enCoursDeLecture;

    this.ttsService.arreterLecture().pipe(
      tap(() => {
        this.enCoursDeLecture = false;
        this.phraseActiveeIndex = null;
      }),
      filter(() => !etaitEnLecture),
      tap(() => {
        this.enCoursDeLecture = true;
        this.phraseActiveeIndex = index;
      }),
      switchMap(() => phrasePropre ? this.ttsService.lireTexte(phrasePropre, this.voixSelectionnee) : of(undefined)),
      switchMap(() => timer(phrasePropre.length * DELAI_PHRASE_MS + DELAI_PHRASE_BASE_MS)),
      tap(() => { this.phraseActiveeIndex = null; }),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  private sauvegarderMot(part: { texte: string }) {
    const motPropre = part.texte.replace(/[^a-zA-ZÀ-ÿ'-]/g, '');
    if (!motPropre) return;
    this.vocabulaireService.ajouterMot(motPropre).pipe(
      tap(() => this.motsSauvegardes.add(motPropre.toLowerCase())),
      takeUntil(this.destroy$),
    ).subscribe();
  }
}
