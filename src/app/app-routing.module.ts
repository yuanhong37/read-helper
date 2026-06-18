import { Routes } from '@angular/router';
import { OcrSpeechComponent } from './features/ocr-speech/ocr-speech.component';
import { VocabulaireComponent } from './features/vocabulaire/vocabulaire.component';
import { HistoriqueComponent } from './features/historique/historique.component';
import { FlashcardComponent } from './features/flashcard/flashcard.component';

export const routes: Routes = [
  { path: '', component: OcrSpeechComponent },
  { path: 'vocabulaire', component: VocabulaireComponent },
  { path: 'historique', component: HistoriqueComponent },
  { path: 'flashcard', component: FlashcardComponent },
];
