import { commonStrings } from './strings/common';
import { landingStrings } from './strings/landing';
import { testStrings } from './strings/tests';
import { dossierStrings } from './strings/dossier';
import { studyMaterialGuideStrings } from './strings/studyMaterials';
import { testRunnerStrings } from './strings/testRunner';
import { piqStrings, upgradeGateStrings } from './strings/piq';
import { studyStrings } from './strings/study';
import { notificationStrings } from './strings/notifications';
import { supportStrings } from './strings/support';

export const strings = {
  ...commonStrings,
  landing: landingStrings,
  ...testStrings,
  ...dossierStrings,
  studyMaterialGuides: studyMaterialGuideStrings,
  testRunner: testRunnerStrings,
  piq: piqStrings,
  upgradeGate: upgradeGateStrings,
  study: studyStrings,
  notifications: notificationStrings,
  support: supportStrings
} as const;
