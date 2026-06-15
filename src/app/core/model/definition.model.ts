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
