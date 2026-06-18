import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { Observable, defer, from } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { MotVocabulaire, TexteHistorique } from '../model/vocabulaire.model';

const STORAGE_KEY = 'vocabulaire';
const HISTORIQUE_KEY = 'historique-textes';
const TEXTE_ACTIF_KEY = 'texte-actif';

@Injectable({
  providedIn: 'root'
})
export class VocabulaireService {

  // Vocabulaire

  getMots(): Observable<MotVocabulaire[]> {
    return defer(() =>
      Preferences.get({ key: STORAGE_KEY }).then(({ value }) =>
        value ? JSON.parse(value) as MotVocabulaire[] : [],
      ),
    );
  }

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

  modifierMot(id: string, nouveauMot: string): Observable<boolean> {
    const nouveauLower = nouveauMot.toLowerCase();
    return this.getMots().pipe(
      map(mots => {
        const existe = mots.some(m => m.id !== id && m.mot.toLowerCase() === nouveauLower);
        if (existe) return { mots: null as MotVocabulaire[] | null, modifie: false };
        const updated = mots.map(m => m.id === id ? { ...m, mot: nouveauMot } : m);
        return { mots: updated, modifie: true };
      }),
      switchMap(({ mots, modifie }) => {
        if (!modifie || !mots) return from(Promise.resolve(false));
        return from(Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(mots) })).pipe(map(() => true));
      }),
    );
  }

  supprimerMot(id: string): Observable<void> {
    return this.getMots().pipe(
      map(mots => mots.filter(m => m.id !== id)),
      switchMap(restants => from(Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(restants) }))),
    );
  }

  contientMot(mot: string): Observable<boolean> {
    const motLower = mot.toLowerCase();
    return this.getMots().pipe(
      map(mots => mots.some(m => m.mot.toLowerCase() === motLower)),
    );
  }

  // Historique

  getHistorique(): Observable<TexteHistorique[]> {
    return defer(() =>
      Preferences.get({ key: HISTORIQUE_KEY }).then(({ value }) =>
        value ? JSON.parse(value) as TexteHistorique[] : [],
      ),
    );
  }

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

  supprimerTexteHistorique(id: string): Observable<void> {
    return this.getHistorique().pipe(
      map(liste => liste.filter(e => e.id !== id)),
      switchMap(restants => from(Preferences.set({ key: HISTORIQUE_KEY, value: JSON.stringify(restants) }))),
    );
  }

  // Texte actif

  sauvegarderTexteActif(texte: string): Observable<void> {
    return defer(() => Preferences.set({ key: TEXTE_ACTIF_KEY, value: texte }));
  }

  chargerTexteActif(): Observable<string | null> {
    return defer(() =>
      Preferences.get({ key: TEXTE_ACTIF_KEY }).then(({ value }) => value ?? null),
    );
  }
}
