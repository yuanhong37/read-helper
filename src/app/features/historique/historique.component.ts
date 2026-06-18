import { Component, inject, DestroyRef } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { map, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TexteHistorique } from '../../core/model/vocabulaire.model';
import { VocabulaireService } from '../../core/services/vocabulaire.service';

@Component({
    selector: 'app-historique',
    templateUrl: './historique.component.html',
    styleUrls: ['./historique.component.scss'],
    imports: [RouterLink],
})
export class HistoriqueComponent {
  entrees: TexteHistorique[] = [];

  private destroyRef = inject(DestroyRef);
  private vocabulaireService = inject(VocabulaireService);
  private router = inject(Router);

  private historiqueSub = this.vocabulaireService.getHistorique().pipe(
    map(liste => liste.reverse()),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(liste => this.entrees = liste);

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  restaurer(entry: TexteHistorique) {
    this.vocabulaireService.sauvegarderTexteActif(entry.texte).pipe(
      tap(() => this.router.navigate(['/'])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }

  supprimer(id: string) {
    this.vocabulaireService.supprimerTexteHistorique(id).pipe(
      tap(() => this.entrees = this.entrees.filter(e => e.id !== id)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe();
  }
}
