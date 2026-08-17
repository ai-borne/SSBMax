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

function getString(data, key) {
  const v = data[key];
  return typeof v === 'string' ? v.trim() : '';
}

function getBoolean(data, key) {
  return data[key] === true;
}

function getMap(data, key) {
  const v = data[key];
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}

function getListOfMaps(data, key) {
  const v = data[key];
  return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
}

function orDefault(value, fallback) {
  return value && value.trim() !== '' ? value : fallback;
}

function toIntOrNull(s) {
  return /^-?\d+$/.test(s) ? parseInt(s, 10) : null;
}

function deriveResidenceType(population) {
  if (!population || population.trim() === '') return 'Unknown background';
  if (/metro/i.test(population)) return 'Metropolitan city';
  if (/lakh/i.test(population)) return 'Large city';
  if (/50000|50,000/i.test(population)) return 'Town';
  const n = toIntOrNull(population);
  if (n !== null) {
    if (n > 100000) return 'City';
    if (n > 50000) return 'Town';
    if (n > 10000) return 'Small town';
  }
  return 'Rural/Village background';
}

function buildPersonalBackground(f) {
  const residenceType = deriveResidenceType(f.maxResidencePopulation);
  const mobilityContext =
    f.permanentAddress !== f.presentAddress && f.presentAddress !== '' ? 'Has relocated from permanent address' : 'Living at permanent address';

  return `PERSONAL BACKGROUND:
- Name: ${orDefault(f.fullName, 'Not provided')}
- Age: ${orDefault(f.age, 'Not provided')}
- Gender: ${orDefault(f.gender, 'Not provided')}
- From: ${orDefault(f.district, 'Unknown district')}, ${orDefault(f.state, 'Unknown state')}
- Background: ${residenceType}${f.isDistrictHQ ? ' (District HQ)' : ''}
- Marital Status: ${orDefault(f.maritalStatus, 'Not provided')}
- Religion: ${orDefault(f.religion, 'Not provided')}
- Mother Tongue: ${orDefault(f.motherTongue, 'Not provided')}
- Mobility: ${mobilityContext}
- Physical: Height ${orDefault(f.height, 'N/A')}m, Weight ${orDefault(f.weight, 'N/A')}kg`;
}

function deriveFamilyContext(f) {
  const contexts = [];
  const defenseKeywords = ['army', 'navy', 'air force', 'military', 'forces', 'jco', 'nco', 'officer'];
  if (defenseKeywords.some((k) => f.fatherOccupation.toLowerCase().includes(k))) {
    contexts.push('Defense family background');
  }
  if (/only/i.test(f.parentsAlive) || f.ageAtFatherDeath !== '' || f.ageAtMotherDeath !== '') {
    contexts.push('Single parent/guardian upbringing');
  }
  if (f.motherOccupation !== '' && !/housewife|homemaker/i.test(f.motherOccupation)) {
    contexts.push('Working mother');
  }
  const govtKeywords = ['govt', 'government', 'psu', 'public sector', 'ias', 'ips'];
  if (govtKeywords.some((k) => f.fatherOccupation.toLowerCase().includes(k))) {
    contexts.push('Government service family');
  }
  if (/business|entrepreneur/i.test(f.fatherOccupation)) {
    contexts.push('Business family');
  }
  return contexts.join(', ') || 'Standard family environment';
}

function buildFamilyEnvironment(f) {
  const familyContext = deriveFamilyContext(f);

  let siblingSummary;
  if (f.siblings.length > 0) {
    const parts = f.siblings
      .map((s) => {
        const name = typeof s.name === 'string' ? s.name : '';
        const age = typeof s.age === 'string' ? s.age : '';
        const occupation = typeof s.occupation === 'string' ? s.occupation : '';
        return name.trim() !== '' ? `${name} (${orDefault(age, 'age unknown')}, ${orDefault(occupation, 'occupation unknown')})` : null;
      })
      .filter((s) => s !== null);
    siblingSummary = parts.join('; ') || 'Details not provided';
  } else {
    siblingSummary = 'Only child / No siblings listed';
  }

  let parentsLine = `- Parents Status: ${orDefault(f.parentsAlive, 'Both alive (assumed)')}`;
  if (f.ageAtFatherDeath !== '') parentsLine += `\n  - Lost father at age ${f.ageAtFatherDeath}`;
  if (f.ageAtMotherDeath !== '') parentsLine += `\n  - Lost mother at age ${f.ageAtMotherDeath}`;
  if (f.guardianName !== '') parentsLine += `\n- Guardian: ${f.guardianName} (${f.guardianOccupation})`;

  return `FAMILY ENVIRONMENT:
- Father: ${orDefault(f.fatherName, 'Not provided')}
  - Occupation: ${orDefault(f.fatherOccupation, 'Not provided')}
  - Education: ${orDefault(f.fatherEducation, 'Not provided')}
  - Income: ${orDefault(f.fatherIncome, 'Not provided')}
- Mother: ${orDefault(f.motherName, 'Not provided')}
  - Occupation: ${orDefault(f.motherOccupation, 'Not provided')}
  - Education: ${orDefault(f.motherEducation, 'Not provided')}
${parentsLine}
- Siblings: ${siblingSummary}
- Family Context: ${familyContext}`;
}

function formatEducationLevel(edu, level) {
  const institution = typeof edu.institution === 'string' ? edu.institution : '';
  const board = typeof edu.board === 'string' ? edu.board : '';
  const year = typeof edu.year === 'string' ? edu.year : '';
  const percentage = typeof edu.percentage === 'string' ? edu.percentage : '';
  const cgpa = typeof edu.cgpa === 'string' ? edu.cgpa : '';
  const stream = typeof edu.stream === 'string' ? edu.stream : '';
  const medium = typeof edu.mediumOfInstruction === 'string' ? edu.mediumOfInstruction : '';
  const boarderDay = typeof edu.boarderDayScholar === 'string' ? edu.boarderDayScholar : '';
  const achievement = typeof edu.outstandingAchievement === 'string' ? edu.outstandingAchievement : '';

  let scoreStr;
  if (percentage !== '') scoreStr = `${percentage}%`;
  else if (cgpa !== '') scoreStr = `CGPA: ${cgpa}`;
  else scoreStr = 'Score not provided';

  const details = [
    institution !== '' ? `Institution: ${institution}` : null,
    board !== '' ? `Board: ${board}` : null,
    stream !== '' ? `Stream: ${stream}` : null,
    year !== '' ? `Year: ${year}` : null,
    `Performance: ${scoreStr}`,
    medium !== '' ? `Medium: ${medium}` : null,
    boarderDay !== '' ? `Type: ${boarderDay}` : null,
    achievement !== '' ? `Achievement: ${achievement}` : null
  ].filter((d) => d !== null);

  if (details.length > 0) {
    return `- ${level}:\n  - ${details.join('\n  - ')}`;
  }
  return `- ${level}: Not provided`;
}

function buildEducationJourney(f) {
  const hasPostGrad = typeof f.educationPostGraduation.institution === 'string' && f.educationPostGraduation.institution.trim() !== '';
  const lines = [
    'EDUCATION JOURNEY:',
    formatEducationLevel(f.education10th, '10th Standard'),
    formatEducationLevel(f.education12th, '12th Standard'),
    formatEducationLevel(f.educationGraduation, 'Graduation')
  ];
  if (hasPostGrad) {
    lines.push(formatEducationLevel(f.educationPostGraduation, 'Post-Graduation'));
  }
  return lines.join('\n');
}

function buildCareerAndWork(f) {
  let workSummary;
  if (f.workExperience.length > 0) {
    const parts = f.workExperience
      .map((exp) => {
        const company = typeof exp.company === 'string' ? exp.company : '';
        const role = typeof exp.role === 'string' ? exp.role : '';
        const duration = typeof exp.duration === 'string' ? exp.duration : '';
        const description = typeof exp.description === 'string' ? exp.description : '';
        if (company === '' && role === '') return null;
        let line = `- ${role}`;
        if (company !== '') line += ` at ${company}`;
        if (duration !== '') line += ` (${duration})`;
        if (description !== '') line += `\n    Details: ${description}`;
        return line;
      })
      .filter((l) => l !== null);
    workSummary = parts.join('\n  ') || 'No details provided';
  } else {
    workSummary = 'No prior work experience';
  }

  return `CAREER & WORK:
- Current Occupation: ${orDefault(f.presentOccupation, 'Not specified (likely student/fresher)')}
- Monthly Income: ${orDefault(f.personalMonthlyIncome, 'Not applicable / Not provided')}
- Work Experience:
  ${workSummary}`;
}

function buildActivitiesAndInterests(f) {
  let sportsSummary;
  if (f.sportsParticipation.length > 0) {
    const parts = f.sportsParticipation
      .map((sp) => {
        const sport = typeof sp.sport === 'string' ? sp.sport : '';
        const period = typeof sp.period === 'string' ? sp.period : '';
        const represented = typeof sp.representedInstitution === 'string' ? sp.representedInstitution : '';
        const achievement = typeof sp.outstandingAchievement === 'string' ? sp.outstandingAchievement : '';
        if (sport === '') return null;
        let line = `- ${sport}`;
        if (period !== '') line += ` (played: ${period})`;
        if (represented !== '') line += `\n    Represented: ${represented}`;
        if (achievement !== '') line += `\n    Achievement: ${achievement}`;
        return line;
      })
      .filter((l) => l !== null);
    sportsSummary = parts.join('\n  ') || orDefault(f.sports, 'Not specified');
  } else {
    sportsSummary = orDefault(f.sports, 'Not specified');
  }

  let ecaSummary;
  if (f.extraCurricularActivities.length > 0) {
    const parts = f.extraCurricularActivities
      .map((eca) => {
        const activity = typeof eca.activityName === 'string' ? eca.activityName : '';
        const duration = typeof eca.duration === 'string' ? eca.duration : '';
        const achievement = typeof eca.outstandingAchievement === 'string' ? eca.outstandingAchievement : '';
        if (activity === '') return null;
        let line = `- ${activity}`;
        if (duration !== '') line += ` (${duration})`;
        if (achievement !== '') line += ` - ${achievement}`;
        return line;
      })
      .filter((l) => l !== null);
    ecaSummary = parts.join('\n  ') || 'None listed';
  } else {
    ecaSummary = 'None listed';
  }

  return `ACTIVITIES & INTERESTS:
- Hobbies: ${orDefault(f.hobbies, 'Not specified')}
- Sports:
  ${sportsSummary}
- Extra-Curricular Activities:
  ${ecaSummary}`;
}

function buildLeadershipExposure(f) {
  const hasNCC = f.nccTraining.hasTraining === true;
  let nccDetails;
  if (hasNCC) {
    const wing = typeof f.nccTraining.wing === 'string' ? f.nccTraining.wing : '';
    const division = typeof f.nccTraining.division === 'string' ? f.nccTraining.division : '';
    const certificate = typeof f.nccTraining.certificateObtained === 'string' ? f.nccTraining.certificateObtained : '';
    const totalTraining = typeof f.nccTraining.totalTraining === 'string' ? f.nccTraining.totalTraining : '';
    nccDetails = 'Yes';
    if (wing !== '') nccDetails += ` - ${wing} Wing`;
    if (division !== '') nccDetails += `, ${division} Division`;
    if (certificate !== '') nccDetails += `\n  Certificate: ${certificate}`;
    if (totalTraining !== '') nccDetails += `\n  Training Duration: ${totalTraining}`;
  } else {
    nccDetails = 'No NCC training';
  }

  return `LEADERSHIP EXPOSURE:
- NCC Training: ${nccDetails}
- Positions of Responsibility: ${orDefault(f.positionsOfResponsibility, 'None mentioned')}`;
}

function buildSSBJourney(f) {
  let interviewSummary;
  if (f.previousInterviews.length > 0) {
    const parts = f.previousInterviews.map((interview, index) => {
      const entryType = typeof interview.typeOfEntry === 'string' ? interview.typeOfEntry : '';
      const ssbPlace = typeof interview.ssbPlace === 'string' ? interview.ssbPlace : '';
      const date = typeof interview.date === 'string' ? interview.date : '';
      let line = `${index + 1}. `;
      if (entryType !== '') line += `${entryType} entry`;
      if (ssbPlace !== '') line += ` at ${ssbPlace}`;
      if (date !== '') line += ` (${date})`;
      return line;
    });
    interviewSummary = parts.join('\n  ') || 'Details not provided';
  } else {
    interviewSummary = 'First attempt (Freshie)';
  }

  let attemptContext;
  if (f.previousInterviews.length === 0) attemptContext = 'Fresh candidate - no prior SSB experience';
  else if (f.previousInterviews.length === 1) attemptContext = 'Repeater (1 previous attempt) - has SSB exposure';
  else attemptContext = `Multiple attempts (${f.previousInterviews.length}) - highly determined`;

  return `SSB JOURNEY:
- Choice of Service: ${orDefault(f.choiceOfService, 'Not specified')}
- Nature of Commission: ${orDefault(f.natureOfCommission, 'Not specified')}
- Chances Availed: ${orDefault(f.chancesAvailed, 'Not specified')}
- Previous SSB Attempts:
  ${interviewSummary}
- Candidate Type: ${attemptContext}`;
}

function buildSelfAssessment(f) {
  return `SELF-ASSESSMENT:
- Why Defense Forces:
  ${orDefault(f.whyDefenseForces, 'Not provided')}
- Stated Strengths:
  ${orDefault(f.strengths, 'Not provided')}
- Acknowledged Weaknesses:
  ${orDefault(f.weaknesses, 'Not provided')}`;
}

function buildPersonalizationNotes(data) {
  const notes = [];

  const nccTraining = getMap(data, 'nccTraining');
  if (nccTraining.hasTraining === true) {
    const wing = typeof nccTraining.wing === 'string' ? nccTraining.wing : '';
    const cert = typeof nccTraining.certificateObtained === 'string' ? nccTraining.certificateObtained : '';
    notes.push(`-> Has NCC background (${wing} Wing, ${cert}) - explore leadership experiences`);
  }

  const prevInterviews = getListOfMaps(data, 'previousInterviews');
  if (prevInterviews.length > 0) {
    notes.push('-> Repeater candidate - ask about learning from previous attempt(s)');
  }

  const fatherOcc = getString(data, 'fatherOccupation');
  if (['army', 'navy', 'air force', 'forces'].some((k) => fatherOcc.toLowerCase().includes(k))) {
    notes.push('-> Defense family background - explore influence and expectations');
  }

  const sports = getListOfMaps(data, 'sportsParticipation');
  const hasAchievements = sports.some((s) => {
    const achievement = typeof s.outstandingAchievement === 'string' ? s.outstandingAchievement.trim() : '';
    const represented = typeof s.representedInstitution === 'string' ? s.representedInstitution.trim() : '';
    return achievement !== '' || represented !== '';
  });
  if (hasAchievements) {
    notes.push('-> Sports achievements present - ask about teamwork and competition');
  }

  const workExp = getListOfMaps(data, 'workExperience');
  if (workExp.length > 0) {
    notes.push('-> Has work experience - explore professional challenges and growth');
  }

  const positions = getString(data, 'positionsOfResponsibility');
  if (positions !== '') {
    notes.push('-> Has held leadership positions - probe leadership style and challenges');
  }

  const population = getString(data, 'maximumResidencePopulation');
  const populationN = toIntOrNull(population);
  if ((populationN !== null && populationN < 50000) || /village/i.test(population)) {
    notes.push('-> Rural/small town background - ask about adaptability and exposure');
  }

  return notes.length > 0 ? notes.join('\n') : '-> Standard profile - use general SSB questioning approach';
}

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
