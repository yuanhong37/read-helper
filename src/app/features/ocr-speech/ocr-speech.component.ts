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

type InteractionMode = 'none' | 'drawing' | 'moving'
  | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br'
  | 'resize-top' | 'resize-bottom' | 'resize-left' | 'resize-right';

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
  private interactionMode: InteractionMode = 'none';
  private debutSelection: { x: number; y: number } | null = null;
  private dragOffset: { x: number; y: number } | null = null;
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
    this.detruireCanvas();
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
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.round(s.w);
    tempCanvas.height = Math.round(s.h);
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(
      this.imageChargee,
      Math.round(s.x), Math.round(s.y),
      Math.round(s.w), Math.round(s.h),
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
    const { x, y } = this.getCanvasCoords(event.clientX, event.clientY);

    const handle = this.getHandleAt(x, y);
    if (handle) {
      this.interactionMode = handle;
      this.debutSelection = { x, y };
      return;
    }

    if (this.selectionActuelle && this.isInsideRect(x, y)) {
      this.interactionMode = 'moving';
      this.dragOffset = { x: x - this.selectionActuelle.x, y: y - this.selectionActuelle.y };
      return;
    }

    if (this.selectionActuelle) {
      this.selectionActuelle = null;
      this.interactionMode = 'none';
      this.redessiner();
    } else {
      this.debutSelection = { x, y };
      this.interactionMode = 'drawing';
    }
  }

  onCanvasMouseMove(event: MouseEvent) {
    const { x, y } = this.getCanvasCoords(event.clientX, event.clientY);

    if (this.interactionMode === 'drawing' && this.debutSelection) {
      this.selectionActuelle = {
        x: Math.min(this.debutSelection.x, x),
        y: Math.min(this.debutSelection.y, y),
        w: Math.abs(x - this.debutSelection.x),
        h: Math.abs(y - this.debutSelection.y),
      };
      this.redessiner();
      return;
    }

    if (this.interactionMode === 'moving' && this.dragOffset && this.selectionActuelle) {
      const canvas = this.canvasRef.nativeElement;
      const s = this.selectionActuelle;
      let nx = x - this.dragOffset.x;
      let ny = y - this.dragOffset.y;
      nx = Math.max(0, Math.min(nx, canvas.width - s.w));
      ny = Math.max(0, Math.min(ny, canvas.height - s.h));
      this.selectionActuelle = { x: nx, y: ny, w: s.w, h: s.h };
      this.redessiner();
      return;
    }

    if (this.interactionMode.startsWith('resize-') && this.debutSelection && this.selectionActuelle) {
      const s = this.selectionActuelle;
      const minSize = 10;
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;

      if (this.interactionMode === 'resize-tl') {
        nx = Math.min(x, s.x + s.w - minSize);
        ny = Math.min(y, s.y + s.h - minSize);
        nw = s.x + s.w - nx;
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-tr') {
        ny = Math.min(y, s.y + s.h - minSize);
        nw = Math.max(minSize, x - s.x);
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-bl') {
        nx = Math.min(x, s.x + s.w - minSize);
        nw = s.x + s.w - nx;
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-br') {
        nw = Math.max(minSize, x - s.x);
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-top') {
        ny = Math.min(y, s.y + s.h - minSize);
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-bottom') {
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-left') {
        nx = Math.min(x, s.x + s.w - minSize);
        nw = s.x + s.w - nx;
      } else if (this.interactionMode === 'resize-right') {
        nw = Math.max(minSize, x - s.x);
      }

      this.selectionActuelle = { x: nx, y: ny, w: nw, h: nh };
      this.redessiner();
      return;
    }

    const handleHover = this.getHandleAt(x, y);
    if (handleHover) {
      this.canvasRef.nativeElement.style.cursor = this.cursorForMode(handleHover);
    } else if (this.selectionActuelle && this.isInsideRect(x, y)) {
      this.canvasRef.nativeElement.style.cursor = 'move';
    } else {
      this.canvasRef.nativeElement.style.cursor = 'crosshair';
    }
  }

  onCanvasMouseUp(_event: MouseEvent) {
    this.interactionMode = 'none';
    this.dragOffset = null;
  }

  onCanvasTouchStart(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    const { x, y } = this.getCanvasCoords(touch.clientX, touch.clientY);

    const handle = this.getHandleAt(x, y);
    if (handle) {
      this.interactionMode = handle;
      this.debutSelection = { x, y };
      return;
    }

    if (this.selectionActuelle && this.isInsideRect(x, y)) {
      this.interactionMode = 'moving';
      this.dragOffset = { x: x - this.selectionActuelle.x, y: y - this.selectionActuelle.y };
      return;
    }

    if (this.selectionActuelle) {
      this.selectionActuelle = null;
      this.interactionMode = 'none';
      this.redessiner();
    } else {
      this.debutSelection = { x, y };
      this.interactionMode = 'drawing';
    }
  }

  onCanvasTouchMove(event: TouchEvent) {
    event.preventDefault();
    const touch = event.touches[0];
    const { x, y } = this.getCanvasCoords(touch.clientX, touch.clientY);

    if (this.interactionMode === 'drawing' && this.debutSelection) {
      this.selectionActuelle = {
        x: Math.min(this.debutSelection.x, x),
        y: Math.min(this.debutSelection.y, y),
        w: Math.abs(x - this.debutSelection.x),
        h: Math.abs(y - this.debutSelection.y),
      };
      this.redessiner();
      return;
    }

    if (this.interactionMode === 'moving' && this.dragOffset && this.selectionActuelle) {
      const canvas = this.canvasRef.nativeElement;
      const s = this.selectionActuelle;
      let nx = x - this.dragOffset.x;
      let ny = y - this.dragOffset.y;
      nx = Math.max(0, Math.min(nx, canvas.width - s.w));
      ny = Math.max(0, Math.min(ny, canvas.height - s.h));
      this.selectionActuelle = { x: nx, y: ny, w: s.w, h: s.h };
      this.redessiner();
      return;
    }

    if (this.interactionMode.startsWith('resize-') && this.debutSelection && this.selectionActuelle) {
      const s = this.selectionActuelle;
      const minSize = 10;
      let nx = s.x, ny = s.y, nw = s.w, nh = s.h;

      if (this.interactionMode === 'resize-tl') {
        nx = Math.min(x, s.x + s.w - minSize);
        ny = Math.min(y, s.y + s.h - minSize);
        nw = s.x + s.w - nx;
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-tr') {
        ny = Math.min(y, s.y + s.h - minSize);
        nw = Math.max(minSize, x - s.x);
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-bl') {
        nx = Math.min(x, s.x + s.w - minSize);
        nw = s.x + s.w - nx;
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-br') {
        nw = Math.max(minSize, x - s.x);
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-top') {
        ny = Math.min(y, s.y + s.h - minSize);
        nh = s.y + s.h - ny;
      } else if (this.interactionMode === 'resize-bottom') {
        nh = Math.max(minSize, y - s.y);
      } else if (this.interactionMode === 'resize-left') {
        nx = Math.min(x, s.x + s.w - minSize);
        nw = s.x + s.w - nx;
      } else if (this.interactionMode === 'resize-right') {
        nw = Math.max(minSize, x - s.x);
      }

      this.selectionActuelle = { x: nx, y: ny, w: nw, h: nh };
      this.redessiner();
      return;
    }
  }

  onCanvasTouchEnd(event: TouchEvent) {
    event.preventDefault();
    this.interactionMode = 'none';
    this.dragOffset = null;
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
      let displayW = maxWidth;
      let displayH = displayW / aspectRatio;
      if (displayH > maxHeight) {
        displayH = maxHeight;
        displayW = displayH * aspectRatio;
      }
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.width = displayW + 'px';
      canvas.style.height = displayH + 'px';
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
    for (const [cx, cy] of [[s.x + s.w / 2, s.y], [s.x + s.w / 2, s.y + s.h], [s.x, s.y + s.h / 2], [s.x + s.w, s.y + s.h / 2]]) {
      ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
      ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
    }
  }

  private getCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private getHandleAt(x: number, y: number): InteractionMode | null {
    if (!this.selectionActuelle) return null;
    const s = this.selectionActuelle;
    const hs = 8;
    const corners: { mode: InteractionMode; cx: number; cy: number }[] = [
      { mode: 'resize-tl', cx: s.x, cy: s.y },
      { mode: 'resize-tr', cx: s.x + s.w, cy: s.y },
      { mode: 'resize-bl', cx: s.x, cy: s.y + s.h },
      { mode: 'resize-br', cx: s.x + s.w, cy: s.y + s.h },
    ];
    for (const h of corners) {
      if (Math.abs(x - h.cx) <= hs / 2 && Math.abs(y - h.cy) <= hs / 2) {
        return h.mode;
      }
    }
    const edges: { mode: InteractionMode; cx: number; cy: number }[] = [
      { mode: 'resize-top', cx: s.x + s.w / 2, cy: s.y },
      { mode: 'resize-bottom', cx: s.x + s.w / 2, cy: s.y + s.h },
      { mode: 'resize-left', cx: s.x, cy: s.y + s.h / 2 },
      { mode: 'resize-right', cx: s.x + s.w, cy: s.y + s.h / 2 },
    ];
    for (const h of edges) {
      if (Math.abs(x - h.cx) <= hs / 2 && Math.abs(y - h.cy) <= hs / 2) {
        return h.mode;
      }
    }
    return null;
  }

  private isInsideRect(x: number, y: number): boolean {
    if (!this.selectionActuelle) return false;
    const s = this.selectionActuelle;
    return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h;
  }

  private cursorForMode(mode: InteractionMode): string {
    const map: Record<string, string> = {
      'resize-tl': 'nwse-resize',
      'resize-br': 'nwse-resize',
      'resize-tr': 'nesw-resize',
      'resize-bl': 'nesw-resize',
      'resize-top': 'n-resize',
      'resize-bottom': 's-resize',
      'resize-left': 'w-resize',
      'resize-right': 'e-resize',
    };
    return map[mode] || 'crosshair';
  }

  onWrapperClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.selectionActuelle = null;
      this.redessiner();
    }
  }

  private detruireCanvas() {
    this.imageChargee = null;
    this.selectionActuelle = null;
    this.debutSelection = null;
    this.interactionMode = 'none';
    this.dragOffset = null;
  }
}
