import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { OcrSpeechComponent } from './features/ocr-speech/ocr-speech.component';
import { VocabulaireComponent } from './features/vocabulaire/vocabulaire.component';
import { HistoriqueComponent } from './features/historique/historique.component';

@NgModule({
  declarations: [
    AppComponent,
    OcrSpeechComponent,
    VocabulaireComponent,
    HistoriqueComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
