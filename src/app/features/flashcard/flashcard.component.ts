import { Component, inject, DestroyRef } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Definition } from '../../core/model/definition.model';
import { MotVocabulaire } from '../../core/model/vocabulaire.model';
import { DictionnaireService } from '../../core/services/dictionnaire.service';
import { TtsService } from '../../core/services/tts.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

interface CarteFlash {
  mot: string;
  definition: Definition | null;
  chargement: boolean;
  erreur: string | null;
}

@Component({
    selector: 'app-flashcard',
    templateUrl: './flashcard.component.html',
    styleUrls: ['./flashcard.component.scss'],
    imports: [RouterLink],
})
export class FlashcardComponent {
  enJeu = false;
  partieTerminee = false;
  cartes: CarteFlash[] = [];
  indexCourant = 0;
  faceVisible: 'mot' | 'definition' = 'mot';
  nbMotsDisponibles = 0;

  private destroyRef = inject(DestroyRef);
  private vocabulaireService = inject(VocabulaireService);
  private dictionnaireService = inject(DictionnaireService);
  private ttsService = inject(TtsService);

  constructor() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.nbMotsDisponibles = mots.length),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  get carteCourante(): CarteFlash | null {
    return this.cartes[this.indexCourant] ?? null;
  }

  get totalCartes(): number {
    return this.cartes.length;
  }

  get peutPrecedent(): boolean {
    return this.indexCourant > 0;
  }

  get peutSuivant(): boolean {
    return this.indexCourant < this.totalCartes - 1;
  }

  get flipActive(): boolean {
    return this.faceVisible === 'definition';
  }

  commencerPartie() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => {
        if (mots.length === 0) return;
        const selection = this.piocherMots(mots, 10);
        this.cartes = selection.map(m => ({
          mot: m.mot,
          definition: null,
          chargement: true,
          erreur: null,
        }));
        this.enJeu = true;
        this.partieTerminee = false;
        this.indexCourant = 0;
        this.faceVisible = 'mot';
        this.chargerDefinitions(selection);
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  private piocherMots(mots: MotVocabulaire[], n: number): MotVocabulaire[] {
    const copie = [...mots];
    for (let i = copie.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copie[i], copie[j]] = [copie[j], copie[i]];
    }
    return copie.slice(0, n);
  }

  private chargerDefinitions(selection: MotVocabulaire[]) {
    const requetes = selection.map(m =>
      this.dictionnaireService.getDefinition(m.mot).pipe(
        map(def => ({ index: selection.indexOf(m), def })),
        catchError(() => of({ index: selection.indexOf(m), def: null })),
      ),
    );

    forkJoin(requetes).pipe(
      tap(resultats => {
        for (const { index, def } of resultats) {
          this.cartes[index].chargement = false;
          if (def) {
            this.cartes[index].definition = def;
          } else {
            this.cartes[index].erreur = 'Définition non disponible';
          }
        }
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  cartePrecedente() {
    if (!this.peutPrecedent) return;
    this.indexCourant--;
    this.faceVisible = 'mot';
  }

  carteSuivante() {
    if (this.indexCourant === this.totalCartes - 1) {
      this.partieTerminee = true;
      return;
    }
    this.indexCourant++;
    this.faceVisible = 'mot';
  }

  tournerCarte() {
    this.faceVisible = this.faceVisible === 'mot' ? 'definition' : 'mot';
  }

  prononcerMot(mot: string) {
    this.ttsService.arreterLecture().pipe(
      tap(() => this.ttsService.lireTexte(mot).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe()),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  rejouer() {
    this.enJeu = false;
    this.partieTerminee = false;
    this.cartes = [];
    this.indexCourant = 0;
    this.faceVisible = 'mot';
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.nbMotsDisponibles = mots.length),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
