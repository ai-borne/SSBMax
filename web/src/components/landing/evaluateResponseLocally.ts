import { strings } from '../../constants/strings';

export interface HeuristicResult {
  factorScore: number;
  ratingLabel: string;
  matchedOlqs: string[];
  assessorFeedback: string;
  isOfficerGrade: boolean;
}

export const evaluateResponseLocally = (text: string): HeuristicResult => {
  const lower = text.toLowerCase();
  const officerKeywords = ['took charge', 'delegated', 'immediately', 'planned', 'led', 'organized', 'completed', 'extinguished', 'rescued', 'decided', 'action', 'helped'];
  const matched = officerKeywords.filter((k) => lower.includes(k));

  if (matched.length >= 2 || lower.includes('officer action')) {
    return {
      factorScore: 8.8,
      ratingLabel: strings.landing.heuristicOfficerTitle,
      matchedOlqs: [strings.landing.olqInitiative, strings.landing.olqSpeedDecision, strings.landing.olqOrganizing],
      assessorFeedback: strings.landing.heuristicOfficerFeedback,
      isOfficerGrade: true
    };
  }

  if (matched.length === 1 || lower.includes('standard response') || lower.length > 15) {
    return {
      factorScore: 6.8,
      ratingLabel: strings.landing.heuristicAverageTitle,
      matchedOlqs: [strings.landing.olqCooperation, strings.landing.olqDuty],
      assessorFeedback: strings.landing.heuristicAverageFeedback,
      isOfficerGrade: false
    };
  }

  return {
    factorScore: 5.2,
    ratingLabel: strings.landing.heuristicPassiveTitle,
    matchedOlqs: [strings.landing.olqProactive],
    assessorFeedback: strings.landing.heuristicPassiveFeedback,
    isOfficerGrade: false
  };
};
