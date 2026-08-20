/**
 * Personal, Family, and Education section builders for PIQ context.
 * Server-side port of `PIQContextPersonalSection.kt`.
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

module.exports = {
  getString,
  getBoolean,
  getMap,
  getListOfMaps,
  orDefault,
  toIntOrNull,
  deriveResidenceType,
  buildPersonalBackground,
  buildFamilyEnvironment,
  buildEducationJourney
};
