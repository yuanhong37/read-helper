import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, of, timer, Observable } from 'rxjs';
import { filter, map, switchMap, tap, takeUntil, catchError, finalize } from 'rxjs/operators';
import { SpeechSynthesisVoice } from '@capacitor-community/text-to-speech';
import { CameraService } from '../../core/services/camera.services';
import { OcrSpeechService } from '../../core/services/ocr-speech.service';
import { TtsService } from '../../core/services/tts.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

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
  motsSauvegardes: Set<string> = new Set();
  private longPressTimer: any = null;
  private longPressDetected: boolean = false;

  /** Découpe le texte en tokens (mot / séparateur) pour l'affichage cliquable. */
  get mots(): { texte: string; estMot: boolean }[] {
    if (!this.texteExtrait) return [];
    const parties = this.texteExtrait.split(/(\s+)/);
    return parties.map(p => ({ texte: p, estMot: /[a-zA-ZÀ-ÿ]/.test(p) }));
  }

  /** Découpe le texte en phrases (séparateur . ! ?) pour le mode "Par phrase". */
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

  /** Charge le vocabulaire, le texte actif et la liste des voix au démarrage. */
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

  /** Nettoie les souscriptions pour éviter les fuites mémoire. */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Met à jour la voix sélectionnée dans le dropdown. */
  surChangementVoix(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.voixSelectionnee = parseInt(select.value, 10);
  }

  /** Prend une photo, exécute l'OCR, puis sauvegarde le texte dans l'historique et comme texte actif. */
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

  /** Lit l'intégralité du texte extrait avec la voix sélectionnée. */
  lireLeTexte() {
    this.enCoursDeLecture = true;
    this.ttsService.lireTexte(this.texteExtrait, this.voixSelectionnee).pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  /** Stoppe la lecture TTS et réinitialise les index de surbrillance. */
  arreterLaLecture() {
    this.enCoursDeLecture = false;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
    this.ttsService.arreterLecture().pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  /** Prononce un mot spécifique (appelé par clic court) et le surligne temporairement. */
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

  /** Déclenche un timer de 500ms — si le doigt reste appuyé, on sauvegarde le mot. */
  onPointerDown(part: { texte: string }, index: number) {
    this.longPressDetected = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressDetected = true;
      this.sauvegarderMot(part);
    }, 500);
  }

  /** Relâchement : si le long-press n'a pas eu lieu, on prononce le mot (clic court). */
  onPointerUp(part: { texte: string }, index: number) {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    if (!this.longPressDetected) {
      this.prononcerMot(part.texte, index);
    }
  }

  /** Annulation du geste (le doigt quitte la zone) → nettoie le timer. */
  onPointerCancel() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.longPressDetected = false;
  }

  /** Sauvegarde un mot dans le vocabulaire via le service. */
  private sauvegarderMot(part: { texte: string }) {
    const motPropre = part.texte.replace(/[^a-zA-ZÀ-ÿ'-]/g, '');
    if (!motPropre) return;
    this.vocabulaireService.ajouterMot(motPropre).pipe(
      tap(() => this.motsSauvegardes.add(motPropre.toLowerCase())),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  /** Bascule entre les modes "Texte complet" et "Par phrase". */
  changerMode(mode: LectureMode) {
    this.modeLecture = mode;
    this.motActifIndex = null;
    this.phraseActiveeIndex = null;
    this.ttsService.arreterLecture().pipe(
      takeUntil(this.destroy$),
    ).subscribe();
  }

  /** Prononce une phrase spécifique en mode "Par phrase" avec surbrillance temporaire. */
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
}
