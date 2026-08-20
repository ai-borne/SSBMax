/**
 * Career, Activities, Leadership, SSB Journey, Self-Assessment and Notes for PIQ context.
 * Server-side port of `PIQContext{Life,Final}Sections.kt`.
 */

const { getString, getMap, getListOfMaps, orDefault, toIntOrNull } = require('./piqPersonalSections');

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

module.exports = {
  buildCareerAndWork,
  buildActivitiesAndInterests,
  buildLeadershipExposure,
  buildSSBJourney,
  buildSelfAssessment,
  buildPersonalizationNotes
};
