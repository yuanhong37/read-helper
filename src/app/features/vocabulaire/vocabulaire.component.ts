import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { VocabulaireService, MotVocabulaire } from '../../core/services/vocabulaire.service';

@Component({
  selector: 'app-vocabulaire',
  templateUrl: './vocabulaire.component.html',
  styleUrls: ['./vocabulaire.component.scss']
})
export class VocabulaireComponent implements OnInit, OnDestroy {
  mots: MotVocabulaire[] = [];
  private destroy$ = new Subject<void>();

  constructor(private vocabulaireService: VocabulaireService) {}

  ngOnInit() {
    this.vocabulaireService.getMots().pipe(
      takeUntil(this.destroy$),
    ).subscribe(mots => this.mots = mots);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Formate une date ISO en JJ/MM/AAAA. */
  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  /** Supprime un mot du vocabulaire. */
  supprimer(id: string) {
    this.vocabulaireService.supprimerMot(id).pipe(
      tap(() => this.mots = this.mots.filter(m => m.id !== id)),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  /** Recharge la liste depuis le stockage. */
  recharger() {
    this.vocabulaireService.getMots().pipe(
      tap(mots => this.mots = mots),
      takeUntil(this.destroy$),
    ).subscribe();
  }
}
