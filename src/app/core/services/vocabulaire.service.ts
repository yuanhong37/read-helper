import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface MotVocabulaire {
  id: string;
  mot: string;
  dateCreation: string;
}

export interface TexteHistorique {
  id: string;
  texte: string;
  dateCreation: string;
  apercu: string;
}

const STORAGE_KEY = 'vocabulaire';
const HISTORIQUE_KEY = 'historique-textes';
const TEXTE_ACTIF_KEY = 'texte-actif';

@Injectable({
  providedIn: 'root'
})
export class VocabulaireService {

  // Vocabulaire

  async getMots(): Promise<MotVocabulaire[]> {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (!value) return [];
    return JSON.parse(value) as MotVocabulaire[];
  }

  async ajouterMot(mot: string): Promise<void> {
    const mots = await this.getMots();
    const existe = mots.some(m => m.mot.toLowerCase() === mot.toLowerCase());
    if (existe) return;

    mots.push({
      id: crypto.randomUUID(),
      mot,
      dateCreation: new Date().toISOString(),
    });
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(mots) });
  }

  async supprimerMot(id: string): Promise<void> {
    const mots = await this.getMots();
    const restants = mots.filter(m => m.id !== id);
    await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(restants) });
  }

  async contientMot(mot: string): Promise<boolean> {
    const mots = await this.getMots();
    return mots.some(m => m.mot.toLowerCase() === mot.toLowerCase());
  }

  // Historique

  async getHistorique(): Promise<TexteHistorique[]> {
    const { value } = await Preferences.get({ key: HISTORIQUE_KEY });
    if (!value) return [];
    return JSON.parse(value) as TexteHistorique[];
  }

  async ajouterTexteHistorique(texte: string): Promise<void> {
    const liste = await this.getHistorique();
    const apercu = texte.length > 80 ? texte.substring(0, 80) + '...' : texte;
    liste.push({
      id: crypto.randomUUID(),
      texte,
      dateCreation: new Date().toISOString(),
      apercu,
    });
    await Preferences.set({ key: HISTORIQUE_KEY, value: JSON.stringify(liste) });
  }

  async supprimerTexteHistorique(id: string): Promise<void> {
    const liste = await this.getHistorique();
    const restants = liste.filter(e => e.id !== id);
    await Preferences.set({ key: HISTORIQUE_KEY, value: JSON.stringify(restants) });
  }

  async sauvegarderTexteActif(texte: string): Promise<void> {
    await Preferences.set({ key: TEXTE_ACTIF_KEY, value: texte });
  }

  async chargerTexteActif(): Promise<string | null> {
    const { value } = await Preferences.get({ key: TEXTE_ACTIF_KEY });
    return value ?? null;
  }
}
