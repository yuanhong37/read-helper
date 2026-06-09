import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VocabulaireService, TexteHistorique } from '../../core/services/vocabulaire.service';

@Component({
  selector: 'app-historique',
  templateUrl: './historique.component.html',
  styleUrls: ['./historique.component.scss']
})
export class HistoriqueComponent implements OnInit {
  entrees: TexteHistorique[] = [];

  constructor(
    private vocabulaireService: VocabulaireService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.entrees = await this.vocabulaireService.getHistorique();
    this.entrees.reverse();
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  async restaurer(entry: TexteHistorique) {
    await this.vocabulaireService.sauvegarderTexteActif(entry.texte);
    await this.router.navigate(['/']);
  }

  async supprimer(id: string) {
    await this.vocabulaireService.supprimerTexteHistorique(id);
    this.entrees = this.entrees.filter(e => e.id !== id);
  }
}
