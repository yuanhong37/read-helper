import { Injectable } from '@angular/core';
import { Observable, defer, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
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

  /** Retourne la liste des mots sauvegardés. */
  getMots(): Observable<MotVocabulaire[]> {
    return defer(() =>
      Preferences.get({ key: STORAGE_KEY }).then(({ value }) =>
        value ? JSON.parse(value) as MotVocabulaire[] : [],
      ),
    );
  }

  /** Ajoute un mot au vocabulaire (ignoré si déjà présent). */
  ajouterMot(mot: string): Observable<void> {
    const motLower = mot.toLowerCase();
    return this.getMots().pipe(
      map(mots => {
        const existe = mots.some(m => m.mot.toLowerCase() === motLower);
        if (existe) return mots;
        mots.push({
          id: crypto.randomUUID(),
          mot,
          dateCreation: new Date().toISOString(),
        });
        return mots;
      }),
      switchMap(mots => from(Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(mots) }))),
    );
  }

  /** Supprime un mot du vocabulaire par son id. */
  supprimerMot(id: string): Observable<void> {
    return this.getMots().pipe(
      map(mots => mots.filter(m => m.id !== id)),
      switchMap(restants => from(Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(restants) }))),
    );
  }

  /** Vérifie si un mot est déjà dans le vocabulaire. */
  contientMot(mot: string): Observable<boolean> {
    const motLower = mot.toLowerCase();
    return this.getMots().pipe(
      map(mots => mots.some(m => m.mot.toLowerCase() === motLower)),
    );
  }

  // Historique

  /** Retourne l'historique complet des scans OCR. */
  getHistorique(): Observable<TexteHistorique[]> {
    return defer(() =>
      Preferences.get({ key: HISTORIQUE_KEY }).then(({ value }) =>
        value ? JSON.parse(value) as TexteHistorique[] : [],
      ),
    );
  }

  /** Enregistre un nouveau texte scanné dans l'historique. */
  ajouterTexteHistorique(texte: string): Observable<void> {
    return this.getHistorique().pipe(
      map(liste => {
        const apercu = texte.length > 80 ? texte.substring(0, 80) + '...' : texte;
        liste.push({
          id: crypto.randomUUID(),
          texte,
          dateCreation: new Date().toISOString(),
          apercu,
        });
        return liste;
      }),
      switchMap(liste => from(Preferences.set({ key: HISTORIQUE_KEY, value: JSON.stringify(liste) }))),
    );
  }

  /** Supprime une entrée de l'historique par son id. */
  supprimerTexteHistorique(id: string): Observable<void> {
    return this.getHistorique().pipe(
      map(liste => liste.filter(e => e.id !== id)),
      switchMap(restants => from(Preferences.set({ key: HISTORIQUE_KEY, value: JSON.stringify(restants) }))),
    );
  }

  /** Sauvegarde le texte actuellement affiché (restauré au prochain chargement). */
  sauvegarderTexteActif(texte: string): Observable<void> {
    return defer(() => Preferences.set({ key: TEXTE_ACTIF_KEY, value: texte }));
  }

  /** Charge le texte actif sauvegardé (ou null si aucun). */
  chargerTexteActif(): Observable<string | null> {
    return defer(() =>
      Preferences.get({ key: TEXTE_ACTIF_KEY }).then(({ value }) => value ?? null),
    );
  }
}
