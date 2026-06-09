import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { OcrSpeechComponent } from './features/ocr-speech/ocr-speech.component';
import { VocabulaireComponent } from './features/vocabulaire/vocabulaire.component';
import { HistoriqueComponent } from './features/historique/historique.component';

const routes: Routes = [
  { path: '', component: OcrSpeechComponent },
  { path: 'vocabulaire', component: VocabulaireComponent },
  { path: 'historique', component: HistoriqueComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
