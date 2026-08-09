import { commonStrings } from './strings/common';
import { landingStrings } from './strings/landing';
import { testStrings } from './strings/tests';
import { dossierStrings } from './strings/dossier';

export const strings = {
  ...commonStrings,
  landing: landingStrings,
  ...testStrings,
  ...dossierStrings
} as const;
