import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { Definition } from '../../core/model/definition.model';
import { MotVocabulaire } from '../../core/model/vocabulaire.model';
import { DictionnaireService } from '../../core/services/dictionnaire.service';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

@Component({
  selector: 'app-vocabulaire',
  templateUrl: './vocabulaire.component.html',
  styleUrls: ['./vocabulaire.component.scss']
})
export class VocabulaireComponent implements OnInit, OnDestroy {
  mots: MotVocabulaire[] = [];
  definitions: Map<string, Definition> = new Map();
  chargementDef: Map<string, boolean> = new Map();
  erreurDef: Map<string, string> = new Map();
  motExpanded: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private vocabulaireService: VocabulaireService,
    private dictionnaireService: DictionnaireService,
  ) {}

  ngOnInit() {
    this.vocabulaireService.getMots().pipe(
      takeUntil(this.destroy$),
    ).subscribe(mots => this.mots = mots);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  supprimer(id: string) {
    this.vocabulaireService.supprimerMot(id).pipe(
      tap(() => {
        this.mots = this.mots.filter(m => m.id !== id);
        const mot = this.mots.find(m => m.id === id);
        if (mot) this.definitions.delete(mot.mot.toLowerCase());
        if (this.motExpanded === id) this.motExpanded = null;
      }),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  recharger() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.mots = mots),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  toggleDefinition(motId: string, motText: string) {
    if (this.motExpanded === motId) {
      this.motExpanded = null;
      return;
    }

    this.motExpanded = motId;
    const key = motText.toLowerCase();

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
      takeUntil(this.destroy$),
    ).subscribe();
  }
}
