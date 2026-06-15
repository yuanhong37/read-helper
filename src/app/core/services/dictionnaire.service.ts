import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, defer, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Preferences } from '@capacitor/preferences';

export interface DefinitionNature {
  nature: string;
  definitions: string[];
}

export interface Definition {
  mot: string;
  natures: DefinitionNature[];
  prononciation: string[];
  synonymes: string[];
  dateRecherche: string;
  url: string;
  redirectVers?: string;
}

interface CacheData {
  [mot: string]: Definition;
}

const CACHE_KEY = 'dictionnaire-definitions';

@Injectable({
  providedIn: 'root'
})
export class DictionnaireService {

  constructor(private http: HttpClient) {}

  getDefinition(mot: string): Observable<Definition | null> {
    const motPropre = this.nettoyerMot(mot).toLowerCase();
    if (!motPropre) return of(null);
    return this.getFromCache(motPropre).pipe(
      switchMap(cached => {
        if (cached) return of(cached);
        return this.fetchFromWiktionary(motPropre).pipe(
          switchMap(def => this.saveToCache(motPropre, def).pipe(map(() => def))),
          catchError(() => of(null)),
        );
      }),
    );
  }

  viderCache(): Observable<void> {
    return defer(() => Preferences.remove({ key: CACHE_KEY }));
  }

  private nettoyerMot(mot: string): string {
    return mot.replace(/^[ldsnmstcj]'\s*/i, '').trim();
  }

  private getFromCache(mot: string): Observable<Definition | null> {
    return defer(() =>
      Preferences.get({ key: CACHE_KEY }).then(({ value }) => {
        if (!value) return null;
        const cache = JSON.parse(value) as CacheData;
        return cache[mot] ?? null;
      }),
    );
  }

  private saveToCache(mot: string, def: Definition): Observable<void> {
    return defer(() =>
      Preferences.get({ key: CACHE_KEY }).then(({ value }) => {
        const cache: CacheData = value ? JSON.parse(value) : {};
        cache[mot] = def;
        return Preferences.set({ key: CACHE_KEY, value: JSON.stringify(cache) });
      }),
    );
  }

  private fetchFromWiktionary(mot: string): Observable<Definition> {
    const url = this.apiUrl(mot);

    return this.http.get<any>(url).pipe(
      map(response => {
        const html = response?.parse?.text?.['*'];
        if (!html) throw new Error('Page vide');
        return this.parseDefinitionHtml(html, mot);
      }),
      switchMap(def => {
        if (def.redirectVers && def.redirectVers.toLowerCase() !== mot.toLowerCase()) {
          return this.http.get<any>(this.apiUrl(def.redirectVers)).pipe(
            map(response => {
              const baseHtml = response?.parse?.text?.['*'];
              if (!baseHtml) return def;
              const baseDef = this.parseDefinitionHtml(baseHtml, def.redirectVers!);
              return {
                ...baseDef,
                mot,
                url: `https://fr.wiktionary.org/wiki/${encodeURIComponent(mot)}`,
              };
            }),
            catchError(() => of(def)),
          );
        }
        return of(def);
      }),
    );
  }

  private apiUrl(mot: string): string {
    return `https://fr.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(mot)}&prop=text&format=json&origin=*`;
  }

  private parseDefinitionHtml(html: string, mot: string): Definition {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const natures: DefinitionNature[] = [];
    let redirectVers: string | undefined;

    const headings = doc.querySelectorAll('div.mw-heading.mw-heading3');

    headings.forEach((headingDiv, idx) => {
      const titreSpan = headingDiv.querySelector('span.titredef');
      if (!titreSpan) return;

      const nature = titreSpan.textContent?.trim() || '';
      if (!nature) return;

      const ol = this.findNextOl(headingDiv);
      if (!ol) return;

      if (idx === 0) {
        const firstLi = ol.querySelector(':scope > li:first-child');
        if (firstLi) {
          const text = firstLi.textContent?.trim() || '';
          const isRedir = /^(?:Pluriel|Féminin singulier|Masculin pluriel|Féminin pluriel)\s+de\s+/i.test(text);
          if (isRedir) {
            const link = firstLi.querySelector('a');
            if (link) {
              redirectVers = link.getAttribute('title') || link.textContent?.trim() || undefined;
            }
          }
        }
      }

      const definitions: string[] = [];
      ol.querySelectorAll(':scope > li').forEach(li => {
        li.querySelectorAll('ul').forEach(u => u.remove());
        const text = li.textContent?.trim();
        if (text) {
          definitions.push(text.replace(/\s+/g, ' ').trim());
        }
      });

      if (definitions.length > 0) {
        natures.push({ nature, definitions });
      }
    });

    if (natures.length === 0) {
      const fallback: string[] = [];
      doc.querySelectorAll('.mw-parser-output > ol > li').forEach(li => {
        const text = li.textContent?.trim();
        if (text && text.length > 3) {
          fallback.push(text.replace(/\s+/g, ' ').trim());
        }
      });
      if (fallback.length > 0) {
        natures.push({ nature: 'Définition', definitions: fallback });
      }
    }

    const prononciation = this.extractPrononciation(doc);
    const synonymes = this.extractSynonymes(doc);

    return {
      mot,
      natures,
      prononciation,
      synonymes,
      redirectVers,
      dateRecherche: new Date().toISOString(),
      url: `https://fr.wiktionary.org/wiki/${encodeURIComponent(mot)}`,
    };
  }

  private findNextOl(startEl: Element): Element | null {
    let el = startEl.nextElementSibling;
    while (el) {
      if (el.tagName === 'OL') return el;
      if (el.classList?.contains('mw-heading')) return null;
      el = el.nextElementSibling;
    }
    return null;
  }

  private extractPrononciation(doc: Document): string[] {
    const prononces: Set<string> = new Set();
    const pronH3 = doc.querySelector('h3#Prononciation');
    if (!pronH3) return [];
    const pronDiv = pronH3.closest('.mw-heading');
    if (!pronDiv) return [];

    let el = pronDiv.nextElementSibling;
    while (el && !el.classList?.contains('mw-heading')) {
      el.querySelectorAll('span.API[title="Prononciation API"]').forEach(span => {
        const text = span.textContent?.trim();
        if (text) prononces.add(text);
      });
      el = el.nextElementSibling;
    }

    return Array.from(prononces);
  }

  private extractSynonymes(doc: Document): string[] {
    const syns: Set<string> = new Set();
    const synH4s = doc.querySelectorAll('h4[id^="Synonymes"]');

    synH4s.forEach(h4 => {
      const synDiv = h4.closest('.mw-heading');
      if (!synDiv) return;
      let el = synDiv.nextElementSibling;
      while (el && !el.classList?.contains('mw-heading')) {
        el.querySelectorAll('bdi.lang-fr a[title]').forEach(a => {
          const text = a.textContent?.trim();
          if (text) syns.add(text);
        });
        el = el.nextElementSibling;
      }
    });

    return Array.from(syns);
  }
}
