import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { OcrSpeechComponent } from './features/scanner/ocr-speech/ocr-speech.component';

@NgModule({
  declarations: [
    AppComponent,
    OcrSpeechComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
