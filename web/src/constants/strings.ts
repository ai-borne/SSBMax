import { commonStrings } from './strings/common';
import { landingStrings } from './strings/landing';
import { testStrings } from './strings/tests';
import { dossierStrings } from './strings/dossier';
import { studyMaterialGuideStrings } from './strings/studyMaterials';

export const strings = {
  ...commonStrings,
  landing: landingStrings,
  ...testStrings,
  ...dossierStrings,
  studyMaterialGuides: studyMaterialGuideStrings
} as const;
