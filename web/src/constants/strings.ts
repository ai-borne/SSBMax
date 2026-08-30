import { commonStrings } from './strings/common';
import { studyMaterialStrings } from './strings/studyMaterial';
import { landingStrings } from './strings/landing';
import { testStrings } from './strings/tests';
import { dossierStrings } from './strings/dossier';
import { studyMaterialGuideStrings } from './strings/studyMaterials';
import { testRunnerStrings } from './strings/testRunner';
import { piqStrings, upgradeGateStrings } from './strings/piq';
import { studyStrings } from './strings/study';
import { notificationStrings } from './strings/notifications';
import { supportStrings } from './strings/support';
import { contentTopicStrings } from './strings/contentTopic';
import { publicFaqStrings } from './strings/faq';
import { analyticsStrings } from './strings/analytics';
import { contentBlockStrings } from './strings/content';

export const strings = {
  ...commonStrings,
  ...studyMaterialStrings,
  landing: landingStrings,
  ...testStrings,
  ...dossierStrings,
  studyMaterialGuides: studyMaterialGuideStrings,
  testRunner: testRunnerStrings,
  piq: piqStrings,
  upgradeGate: upgradeGateStrings,
  study: studyStrings,
  notifications: notificationStrings,
  support: supportStrings,
  ...contentTopicStrings,
  ...publicFaqStrings,
  analytics: analyticsStrings,
  ...contentBlockStrings
} as const;
