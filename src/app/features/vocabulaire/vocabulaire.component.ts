import { Component, OnInit } from '@angular/core';
import { VocabulaireService, MotVocabulaire } from '../../core/services/vocabulaire.service';

@Component({
  selector: 'app-vocabulaire',
  templateUrl: './vocabulaire.component.html',
  styleUrls: ['./vocabulaire.component.scss']
})
export class VocabulaireComponent implements OnInit {
  mots: MotVocabulaire[] = [];

  constructor(private vocabulaireService: VocabulaireService) {}

  async ngOnInit() {
    this.mots = await this.vocabulaireService.getMots();
  }

  formaterDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  async supprimer(id: string) {
    await this.vocabulaireService.supprimerMot(id);
    this.mots = this.mots.filter(m => m.id !== id);
  }

  async recharger() {
    this.mots = await this.vocabulaireService.getMots();
  }
}
