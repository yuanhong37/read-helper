import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { map, tap, takeUntil } from 'rxjs/operators';
import { VocabulaireService, TexteHistorique } from '../../core/services/vocabulaire.service';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  styleUrls: ['./historique.component.scss']
})
export class HistoriqueComponent implements OnInit, OnDestroy {
  entrees: TexteHistorique[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private vocabulaireService: VocabulaireService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.vocabulaireService.getHistorique().pipe(
      map(liste => liste.reverse()),
      takeUntil(this.destroy$),
    ).subscribe(liste => this.entrees = liste);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  restaurer(entry: TexteHistorique) {
    this.vocabulaireService.sauvegarderTexteActif(entry.texte).pipe(
      tap(() => this.router.navigate(['/'])),
      takeUntil(this.destroy$),
    ).subscribe();
  }

  supprimer(id: string) {
    this.vocabulaireService.supprimerTexteHistorique(id).pipe(
      tap(() => this.entrees = this.entrees.filter(e => e.id !== id)),
      takeUntil(this.destroy$),
    ).subscribe();
  }
}
