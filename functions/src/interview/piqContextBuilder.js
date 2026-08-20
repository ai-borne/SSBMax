/**
 * Server-side port of `shared/.../data/repository/PIQContextBuilder.kt` (+ its
 * `PIQContext{Personal,Life,Final}Sections.kt` siblings) -- closes the gap where
 * `createInterviewSession` used to trust a client-supplied `piqContext` string. Now the
 * function fetches the candidate's own `submissions/{piqSnapshotId}` doc and builds the
 * same ~60-field text context server-side, matching `buildComprehensivePIQContext`'s
 * section structure, null-safe field access, and `"Error processing PIQ data..."` sentinel
 * fallback exactly so the Gemini prompt this feeds doesn't silently drift from the Kotlin
 * legacy path still used elsewhere (`InterviewQuestionGenerator.generateAIQuestions`).
 */

const {
  getString,
  getBoolean,
  getMap,
  getListOfMaps,
  deriveResidenceType,
  buildPersonalBackground,
  buildFamilyEnvironment,
  buildEducationJourney
} = require('./piqPersonalSections');

const {
  buildCareerAndWork,
  buildActivitiesAndInterests,
  buildLeadershipExposure,
  buildSSBJourney,
  buildSelfAssessment,
  buildPersonalizationNotes
} = require('./piqLifeSections');

const ERROR_SENTINEL = 'Error processing PIQ data. Basic info only.';

/**
 * @param piqSubmissionDoc the raw `submissions/{id}` doc (`{userId, testType, submittedAt, data:{...}}`)
 *   or an already-unwrapped `data` map -- same envelope-or-unwrapped acceptance as the Kotlin original.
 */
function buildComprehensivePIQContext(piqSubmissionDoc) {
  try {
    const data = piqSubmissionDoc && typeof piqSubmissionDoc.data === 'object' && piqSubmissionDoc.data !== null ? piqSubmissionDoc.data : piqSubmissionDoc;
    if (!data || typeof data !== 'object') {
      return ERROR_SENTINEL;
    }

    const personalBackground = buildPersonalBackground({
      fullName: getString(data, 'fullName'),
      age: getString(data, 'age'),
      gender: getString(data, 'gender'),
      state: getString(data, 'state'),
      district: getString(data, 'district'),
      maritalStatus: getString(data, 'maritalStatus'),
      religion: getString(data, 'religion'),
      motherTongue: getString(data, 'motherTongue'),
      permanentAddress: getString(data, 'permanentAddress'),
      presentAddress: getString(data, 'presentAddress'),
      maxResidencePopulation: getString(data, 'maximumResidencePopulation'),
      isDistrictHQ: getBoolean(data, 'isDistrictHQ'),
      height: getString(data, 'height'),
      weight: getString(data, 'weight')
    });

    const familyEnvironment = buildFamilyEnvironment({
      fatherName: getString(data, 'fatherName'),
      fatherOccupation: getString(data, 'fatherOccupation'),
      fatherEducation: getString(data, 'fatherEducation'),
      fatherIncome: getString(data, 'fatherIncome'),
      motherName: getString(data, 'motherName'),
      motherOccupation: getString(data, 'motherOccupation'),
      motherEducation: getString(data, 'motherEducation'),
      parentsAlive: getString(data, 'parentsAlive'),
      ageAtFatherDeath: getString(data, 'ageAtFatherDeath'),
      ageAtMotherDeath: getString(data, 'ageAtMotherDeath'),
      guardianName: getString(data, 'guardianName'),
      guardianOccupation: getString(data, 'guardianOccupation'),
      siblings: getListOfMaps(data, 'siblings')
    });

    const educationJourney = buildEducationJourney({
      education10th: getMap(data, 'education10th'),
      education12th: getMap(data, 'education12th'),
      educationGraduation: getMap(data, 'educationGraduation'),
      educationPostGraduation: getMap(data, 'educationPostGraduation')
    });

    const careerAndWork = buildCareerAndWork({
      presentOccupation: getString(data, 'presentOccupation'),
      personalMonthlyIncome: getString(data, 'personalMonthlyIncome'),
      workExperience: getListOfMaps(data, 'workExperience')
    });

    const activitiesAndInterests = buildActivitiesAndInterests({
      hobbies: getString(data, 'hobbies'),
      sports: getString(data, 'sports'),
      sportsParticipation: getListOfMaps(data, 'sportsParticipation'),
      extraCurricularActivities: getListOfMaps(data, 'extraCurricularActivities')
    });

    const leadershipExposure = buildLeadershipExposure({
      nccTraining: getMap(data, 'nccTraining'),
      positionsOfResponsibility: getString(data, 'positionsOfResponsibility')
    });

    const ssbJourney = buildSSBJourney({
      previousInterviews: getListOfMaps(data, 'previousInterviews'),
      choiceOfService: getString(data, 'choiceOfService'),
      natureOfCommission: getString(data, 'natureOfCommission'),
      chancesAvailed: getString(data, 'chancesAvailed')
    });

    const selfAssessment = buildSelfAssessment({
      whyDefenseForces: getString(data, 'whyDefenseForces'),
      strengths: getString(data, 'strengths'),
      weaknesses: getString(data, 'weaknesses')
    });

    return [
      'CANDIDATE PROFILE',
      '=================',
      '',
      personalBackground,
      '',
      familyEnvironment,
      '',
      educationJourney,
      '',
      careerAndWork,
      '',
      activitiesAndInterests,
      '',
      leadershipExposure,
      '',
      ssbJourney,
      '',
      selfAssessment,
      '',
      'PERSONALIZATION NOTES:',
      buildPersonalizationNotes(data)
    ].join('\n');
  } catch (e) {
    return ERROR_SENTINEL;
  }
}

module.exports = { buildComprehensivePIQContext, deriveResidenceType, ERROR_SENTINEL };
