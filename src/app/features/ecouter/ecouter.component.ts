import { Component, inject, DestroyRef } from '@angular/core';
import { forkJoin, of, Subject } from 'rxjs';
import { map, tap, catchError, takeUntil } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Definition } from '../../core/model/definition.model';
import { MotVocabulaire } from '../../core/model/vocabulaire.model';
import { DictionnaireService } from '../../core/services/dictionnaire.service';
import { TtsService } from '../../core/services/tts.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

interface ItemEcoute {
  type: 'mot' | 'nature' | 'definition' | 'synonyme';
  texte: string;
  motRef: string;
  natureLabel?: string;
}

@Component({
    selector: 'app-ecouter',
    templateUrl: './ecouter.component.html',
    styleUrls: ['./ecouter.component.scss'],
    imports: [RouterLink, FormsModule],
})
export class EcouterComponent {
  mots: MotVocabulaire[] = [];
  enLecture = false;
  enPause = false;
  termine = false;
  modeBoucle = true;
  definitions: Map<string, Definition> = new Map();
  fileLecture: ItemEcoute[] = [];
  indexCourant = 0;

  toutesLesVoix: SpeechSynthesisVoice[] = [];
  voixDisponibles: SpeechSynthesisVoice[] = [];
  voixSelectionnee = 0;

  private stopSubject = new Subject<void>();
  private forceArret = false;
  private destroyRef = inject(DestroyRef);
  private vocabulaireService = inject(VocabulaireService);
  private dictionnaireService = inject(DictionnaireService);
  private ttsService = inject(TtsService);

  constructor() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.mots = mots),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();

    this.ttsService.getVoices$().pipe(
      tap(voices => {
        this.toutesLesVoix = voices;
        this.voixDisponibles = voices.filter(v =>
          v.lang.toLowerCase() === 'fr-fr',
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();

    this.ttsService.getSavedVoice$().pipe(
      tap(index => this.voixSelectionnee = index),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  get nbMots(): number {
    return this.mots.length;
  }

  get itemCourant(): ItemEcoute | null {
    return this.fileLecture[this.indexCourant] ?? null;
  }

  get totalItems(): number {
    return this.fileLecture.length;
  }

  get progressionMot(): string {
    if (!this.itemCourant) return '';
    const idxMot = this.fileLecture.findIndex(
      (item, i) => item.type === 'mot' && i >= this.indexCourant,
    );
    const totalMots = this.fileLecture.filter(i => i.type === 'mot').length;
    const courant = idxMot >= 0
      ? totalMots - this.fileLecture.slice(idxMot).filter(i => i.type === 'mot').length + 1
      : totalMots;
    return `Mot ${courant} / ${totalMots}`;
  }

  surChangementVoix(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.voixSelectionnee = Number(select.value);
    this.ttsService.saveVoice(this.voixSelectionnee).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  commencerLecture() {
    if (this.mots.length === 0) return;

    const selection = [...this.mots];
    this.definitions.clear();
    this.fileLecture = [];
    this.indexCourant = 0;
    this.termine = false;
    this.enPause = false;
    this.forceArret = false;
    this.stopSubject = new Subject<void>();

    const requetes = selection.map(m =>
      this.dictionnaireService.getDefinition(m.mot).pipe(
        map(def => ({ mot: m.mot, def })),
        catchError(() => of({ mot: m.mot, def: null }))),
    );

    forkJoin(requetes).pipe(
      tap(resultats => {
        for (const { mot, def } of resultats) {
          if (def) this.definitions.set(mot.toLowerCase(), def);
        }
        this.construireFile(selection);
        this.enLecture = true;
        this.lireProchain();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  private construireFile(mots: MotVocabulaire[]) {
    const MAX_DEFS = 3;
    for (const m of mots) {
      this.fileLecture.push({ type: 'mot', texte: m.mot, motRef: m.mot });

      const def = this.definitions.get(m.mot.toLowerCase());
      if (def) {
        let defCount = 0;
        for (const nature of def.natures) {
          if (defCount >= MAX_DEFS) break;

          const defsToAdd: string[] = [];
          for (const d of nature.definitions) {
            if (defCount >= MAX_DEFS) break;
            defsToAdd.push(d);
            defCount++;
          }

          if (defsToAdd.length > 0) {
            this.fileLecture.push({
              type: 'nature',
              texte: nature.nature,
              motRef: m.mot,
              natureLabel: nature.nature,
            });
            for (const d of defsToAdd) {
              this.fileLecture.push({
                type: 'definition',
                texte: d,
                motRef: m.mot,
                natureLabel: nature.nature,
              });
            }
          }
        }
        if (def.synonymes.length > 0) {
          this.fileLecture.push({
            type: 'synonyme',
            texte: `Synonymes : ${def.synonymes.join(', ')}`,
            motRef: m.mot,
          });
        }
      } else {
        this.fileLecture.push({
          type: 'definition',
          texte: 'Définition non disponible',
          motRef: m.mot,
        });
      }
    }
  }

  private lireProchain() {
    if (this.enPause || this.forceArret) return;

    if (this.indexCourant >= this.fileLecture.length) {
      if (this.modeBoucle) {
        this.indexCourant = 0;
        this.lireProchain();
      } else {
        this.termine = true;
        this.enLecture = false;
      }
      return;
    }

    const item = this.fileLecture[this.indexCourant];
    const texte = item.type === 'mot' ? item.texte : item.texte;

    this.ttsService.lireTexte(texte, this.voixSelectionnee).pipe(
      takeUntil(this.stopSubject),
    ).subscribe({
      next: () => this.apresLecture(),
      error: () => this.apresLecture(),
    });
  }

  private apresLecture() {
    if (!this.enPause && !this.forceArret) {
      this.indexCourant++;
      this.lireProchain();
    }
  }

  pauseLecture() {
    this.enPause = true;
    this.ttsService.arreterLecture().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  reprendreLecture() {
    this.enPause = false;
    this.lireProchain();
  }

  arreterLecture() {
    this.forceArret = true;
    this.stopSubject.next();
    this.stopSubject.complete();
    this.ttsService.arreterLecture().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.enLecture = false;
      this.enPause = false;
    });
  }

  reprononcerMotCourant() {
    if (this.itemCourant) {
      this.ttsService.lireTexte(this.itemCourant.texte, this.voixSelectionnee).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe();
    }
  }

  basculerBoucle() {
    this.modeBoucle = !this.modeBoucle;
  }

  rejouer() {
    this.arreterLecture();
    this.commencerLecture();
  }
}
