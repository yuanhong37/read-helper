import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
  imageOriginale: string | undefined = '';
  modeImage: 'aucune' | 'recadrage' = 'aucune';
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
  private debutSelection: { x: number; y: number } | null = null;
  private estEnTrainDeDessiner = false;
  private imageChargee: HTMLImageElement | null = null;
  selectionActuelle: { x: number; y: number; w: number; h: number } | null = null;

  @ViewChild('cropCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

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
    this.texteExtrait = '';
    this.modeLecture = LectureMode.Full;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
    this.modeImage = 'aucune';
    this.imageOriginale = '';

    this.cameraService.prendrePhoto().pipe(
      switchMap(src => {
        if (!src) {
          this.enCoursDeChargement = false;
          return of(null);
        }
        this.imageOriginale = src;
        this.imageAffichee = src;
        this.enCoursDeChargement = false;
        this.modeImage = 'recadrage';
        setTimeout(() => this.initialiserCanvas(), 0);
        return of(null);
      }),
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

  confirmerRecadrage() {
    if (!this.imageChargee) return;
    if (!this.selectionActuelle || this.selectionActuelle.w < 5 || this.selectionActuelle.h < 5) {
      this.passerRecadrage();
      return;
    }
    const s = this.selectionActuelle;
    const canvas = this.canvasRef.nativeElement;
    const scaleX = this.imageChargee.naturalWidth / canvas.width;
    const scaleY = this.imageChargee.naturalHeight / canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(s.w * scaleX);
    tempCanvas.height = Math.round(s.h * scaleY);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(
      this.imageChargee,
      Math.round(s.x * scaleX), Math.round(s.y * scaleY),
      Math.round(s.w * scaleX), Math.round(s.h * scaleY),
      0, 0,
      tempCanvas.width, tempCanvas.height,
    );
    this.lancerOcr(tempCanvas.toDataURL('image/jpeg', 0.9));
  }

  passerRecadrage() {
    if (!this.imageOriginale) return;
    this.lancerOcr(this.imageOriginale);
  }

  onCanvasMouseDown(event: MouseEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.debutSelection = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.estEnTrainDeDessiner = true;
  }

  onCanvasMouseMove(event: MouseEvent) {
    if (!this.estEnTrainDeDessiner || !this.debutSelection) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x2 = event.clientX - rect.left;
    const y2 = event.clientY - rect.top;
    this.selectionActuelle = {
      x: Math.min(this.debutSelection.x, x2),
      y: Math.min(this.debutSelection.y, y2),
      w: Math.abs(x2 - this.debutSelection.x),
      h: Math.abs(y2 - this.debutSelection.y),
    };
    this.redessiner();
  }

  onCanvasMouseUp(_event: MouseEvent) {
    this.estEnTrainDeDessiner = false;
  }

  onCanvasTouchStart(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.debutSelection = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    this.estEnTrainDeDessiner = true;
  }

  onCanvasTouchMove(event: TouchEvent) {
    event.preventDefault();
    if (!this.estEnTrainDeDessiner || !this.debutSelection) return;
    const touch = event.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x2 = touch.clientX - rect.left;
    const y2 = touch.clientY - rect.top;
    this.selectionActuelle = {
      x: Math.min(this.debutSelection.x, x2),
      y: Math.min(this.debutSelection.y, y2),
      w: Math.abs(x2 - this.debutSelection.x),
      h: Math.abs(y2 - this.debutSelection.y),
    };
    this.redessiner();
  }

  onCanvasTouchEnd(event: TouchEvent) {
    event.preventDefault();
    this.estEnTrainDeDessiner = false;
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

  private lancerOcr(src: string) {
    this.enCoursDeChargement = true;
    this.modeImage = 'aucune';

    this.ocrService.extraireTexte(src).pipe(
      tap(texte => this.texteExtrait = texte),
      switchMap(texte =>
        this.vocabulaireService.ajouterTexteHistorique(texte).pipe(
          switchMap(() => this.vocabulaireService.sauvegarderTexteActif(texte)),
        ),
      ),
      catchError(error => {
        console.error('Erreur lors du processus :', error);
        return of(undefined);
      }),
      finalize(() => this.enCoursDeChargement = false),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  initialiserCanvas() {
    if (!this.imageOriginale) return;
    const img = new Image();
    img.onload = () => {
      this.imageChargee = img;
      const canvas = this.canvasRef.nativeElement;
      const parent = canvas.parentElement!;
      const maxWidth = parent.clientWidth;
      const maxHeight = window.innerHeight * 0.6;
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let w = maxWidth;
      let h = w / aspectRatio;
      if (h > maxHeight) {
        h = maxHeight;
        w = h * aspectRatio;
      }
      canvas.width = w;
      canvas.height = h;
      this.redessiner();
    };
    img.src = this.imageOriginale;
  }

  private redessiner() {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const img = this.imageChargee;
    if (!img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (!this.selectionActuelle) return;
    const s = this.selectionActuelle;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, s.y);
    ctx.fillRect(0, s.y + s.h, canvas.width, canvas.height - s.y - s.h);
    ctx.fillRect(0, s.y, s.x, s.h);
    ctx.fillRect(s.x + s.w, s.y, canvas.width - s.x - s.w, s.h);
    ctx.strokeStyle = '#007bff';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x, s.y, s.w, s.h);
    const hs = 8;
    ctx.fillStyle = '#fff';
    for (const [cx, cy] of [[s.x, s.y], [s.x + s.w, s.y], [s.x, s.y + s.h], [s.x + s.w, s.y + s.h]]) {
      ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
      ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }
  }

  private detruireCanvas() {
    this.imageChargee = null;
    this.selectionActuelle = null;
    this.debutSelection = null;
    this.estEnTrainDeDessiner = false;
  }
}
