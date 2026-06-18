import { Component, inject, DestroyRef } from '@angular/core';
import { map, tap, delay } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Definition } from '../../core/model/definition.model';
import { MotVocabulaire } from '../../core/model/vocabulaire.model';
import { DictionnaireService } from '../../core/services/dictionnaire.service';
import { TtsService } from '../../core/services/tts.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-vocabulaire',
    templateUrl: './vocabulaire.component.html',
    styleUrls: ['./vocabulaire.component.scss'],
    imports: [RouterLink, FormsModule],
})
export class VocabulaireComponent {
  mots: MotVocabulaire[] = [];
  definitions: Map<string, Definition> = new Map();
  chargementDef: Map<string, boolean> = new Map();
  erreurDef: Map<string, string> = new Map();
  motExpanded: string | null = null;

  // Feedback
  feedbackMessage: string | null = null;

  // Ajout / modification manuelle
  nouveauMot = '';
  motEdition: { id: string; mot: string } | null = null;

  // Tri
  sortBy: 'date' | 'alpha' = 'date';
  sortAsc = false;

  // Pagination
  page = 1;
  readonly pageSize = 10;

  get motsTries(): MotVocabulaire[] {
    const sorted = [...this.mots];
    if (this.sortBy === 'date') {
      sorted.sort((a, b) =>
        this.sortAsc
          ? a.dateCreation.localeCompare(b.dateCreation)
          : b.dateCreation.localeCompare(a.dateCreation),
      );
    } else {
      sorted.sort((a, b) =>
        this.sortAsc
          ? a.mot.localeCompare(b.mot)
          : b.mot.localeCompare(a.mot),
      );
    }
    return sorted;
  }

  get motsPagines(): MotVocabulaire[] {
    const start = (this.page - 1) * this.pageSize;
    return this.motsTries.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.mots.length / this.pageSize));
  }

  get paginationRange(): number[] {
    const total = this.totalPages;
    const current = this.page;
    const range: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }

  private destroyRef = inject(DestroyRef);
  private vocabulaireService = inject(VocabulaireService);
  private dictionnaireService = inject(DictionnaireService);
  private ttsService = inject(TtsService);

  private motsSub = this.vocabulaireService.getMots().pipe(
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(mots => {
    this.mots = mots;
    if (this.page > this.totalPages) this.page = this.totalPages;
  });

  nettoyerMot(mot: string): string {
    return mot.replace(/^[ldsnmstcj]'\s*/i, '').trim().toLowerCase();
  }

  private afficherFeedback(msg: string) {
    this.feedbackMessage = msg;
    setTimeout(() => this.feedbackMessage = null, 2000);
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  // --- Ajout manuel ---

  ajouterMotManuellement() {
    const mot = this.nouveauMot.trim();
    if (!mot) return;
    this.vocabulaireService.contientMot(mot).pipe(
      tap(existe => {
        if (existe) {
          this.afficherFeedback('Ce mot existe déjà dans le vocabulaire');
          this.nouveauMot = '';
          return;
        }
        this.vocabulaireService.ajouterMot(mot).pipe(
          tap(() => {
            this.nouveauMot = '';
            this.vocabulaireService.getMots().pipe(
              tap(mots => {
                this.mots = mots;
                this.page = 1;
              }),
              takeUntilDestroyed(this.destroyRef),
            ).subscribe();
          }),
          takeUntilDestroyed(this.destroyRef),
        ).subscribe();
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  // --- Modification ---

  demarrerEdition(id: string, mot: string) {
    this.motEdition = { id, mot };
  }

  sauvegarderEdition() {
    if (!this.motEdition) return;
    const mot = this.motEdition.mot.trim();
    if (!mot) return;
    this.vocabulaireService.modifierMot(this.motEdition.id, mot).pipe(
      tap(modifie => {
        if (!modifie) {
          this.afficherFeedback('Ce mot existe déjà dans le vocabulaire');
          return;
        }
        this.mots = this.mots.map(m =>
          m.id === this.motEdition!.id ? { ...m, mot } : m,
        );
        this.motEdition = null;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  annulerEdition() {
    this.motEdition = null;
  }

  // --- Prononciation ---

  prononcerMot(mot: string) {
    this.ttsService.arreterLecture().pipe(
      tap(() => this.ttsService.lireTexte(mot).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  // --- Suppression ---

  supprimer(id: string) {
    this.vocabulaireService.supprimerMot(id).pipe(
      tap(() => {
        const motASupprimer = this.mots.find(m => m.id === id);
        if (motASupprimer) {
          const cleaned = this.nettoyerMot(motASupprimer.mot);
          this.definitions.delete(cleaned);
          this.chargementDef.delete(cleaned);
          this.erreurDef.delete(cleaned);
        }
        this.mots = this.mots.filter(m => m.id !== id);
        if (this.motEdition?.id === id) this.motEdition = null;
        if (this.motExpanded === id) this.motExpanded = null;
        if (this.page > this.totalPages) this.page = this.totalPages;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  // --- Tri ---

  changerTri(type: 'date' | 'alpha') {
    if (this.sortBy === type) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortBy = type;
      this.sortAsc = type === 'date' ? false : true;
    }
    this.page = 1;
  }

  // --- Pagination ---

  changerPage(p: number) {
    if (p < 1 || p > this.totalPages) return;
    this.page = p;
  }

  recharger() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.mots = mots),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  toggleDefinition(motId: string, motText: string) {
    if (this.motEdition) return;

    if (this.motExpanded === motId) {
      this.motExpanded = null;
      return;
    }

    this.motExpanded = motId;
    const key = this.nettoyerMot(motText);

    if (this.definitions.has(key)) return;
    if (this.chargementDef.get(key)) return;

    this.chargementDef.set(key, true);
    this.erreurDef.delete(key);

    this.dictionnaireService.getDefinition(motText).pipe(
      tap(def => {
        this.chargementDef.set(key, false);
        if (def) {
          this.definitions.set(key, def);
        } else {
          this.erreurDef.set(key, 'Définition introuvable sur le Wiktionnaire');
        }
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
