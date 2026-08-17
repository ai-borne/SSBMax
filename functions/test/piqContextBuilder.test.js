/**
 * Interview server-side PIQ context resolution: tests for
 * `src/interview/piqContextBuilder.js`, a port of `PIQContextBuilder.kt`. Each assertion pins
 * a specific Kotlin-side behavior (envelope unwrapping, blank-field defaults, derived-heuristic
 * strings, error sentinel) so the JS port can't silently drift from the prompt text the legacy
 * client-side path still produces for un-migrated flows.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildComprehensivePIQContext, deriveResidenceType, ERROR_SENTINEL } = require('../src/interview/piqContextBuilder');

function submissionDoc(data) {
  return { userId: 'user1', testType: 'PIQ', submittedAt: Date.now(), data };
}

test('buildComprehensivePIQContext unwraps the submissions/{id} envelope via its "data" field', () => {
  const withEnvelope = buildComprehensivePIQContext(submissionDoc({ fullName: 'Rahul Sharma' }));
  const alreadyUnwrapped = buildComprehensivePIQContext({ fullName: 'Rahul Sharma' });
  assert.equal(withEnvelope, alreadyUnwrapped);
  assert.match(withEnvelope, /Name: Rahul Sharma/);
});

test('buildComprehensivePIQContext defaults every blank/missing field to its documented fallback string', () => {
  const text = buildComprehensivePIQContext(submissionDoc({}));
  assert.match(text, /Name: Not provided/);
  assert.match(text, /Age: Not provided/);
  assert.match(text, /From: Unknown district, Unknown state/);
  assert.match(text, /Background: Unknown background/);
  assert.match(text, /Physical: Height N\/Am, Weight N\/Akg/);
  assert.match(text, /Only child \/ No siblings listed/);
  assert.match(text, /No prior work experience/);
  assert.match(text, /Standard family environment/);
  assert.match(text, /First attempt \(Freshie\)/);
  assert.match(text, /Fresh candidate - no prior SSB experience/);
  assert.match(text, /Standard profile - use general SSB questioning approach/);
});

test('buildComprehensivePIQContext returns the exact error sentinel on malformed input (not a thrown exception)', () => {
  assert.equal(buildComprehensivePIQContext(null), ERROR_SENTINEL);
  assert.equal(buildComprehensivePIQContext(undefined), ERROR_SENTINEL);
  assert.equal(buildComprehensivePIQContext('not an object'), ERROR_SENTINEL);
});

test('deriveResidenceType classifies population strings the same way as the Kotlin original', () => {
  assert.equal(deriveResidenceType(''), 'Unknown background');
  assert.equal(deriveResidenceType('Metro city'), 'Metropolitan city');
  assert.equal(deriveResidenceType('5 lakh'), 'Large city');
  assert.equal(deriveResidenceType('50000'), 'Town');
  assert.equal(deriveResidenceType('150000'), 'Town', '"150000" contains the substring "50000", matching before the numeric >100000 check -- same as the Kotlin original');
  assert.equal(deriveResidenceType('200000'), 'City');
  assert.equal(deriveResidenceType('75500'), 'Town');
  assert.equal(deriveResidenceType('20000'), 'Small town');
  assert.equal(deriveResidenceType('5000'), 'Rural/Village background');
  assert.equal(deriveResidenceType('not a number'), 'Rural/Village background');
});

test('buildComprehensivePIQContext marks a mismatched present/permanent address as relocated', () => {
  const text = buildComprehensivePIQContext(submissionDoc({ permanentAddress: 'Delhi', presentAddress: 'Pune' }));
  assert.match(text, /Mobility: Has relocated from permanent address/);
});

test('buildComprehensivePIQContext appends "(District HQ)" only when isDistrictHQ is true', () => {
  const text = buildComprehensivePIQContext(submissionDoc({ maximumResidencePopulation: 'Metro', isDistrictHQ: true }));
  assert.match(text, /Background: Metropolitan city \(District HQ\)/);
});

test('buildComprehensivePIQContext derives "Defense family background" from father occupation keywords', () => {
  const text = buildComprehensivePIQContext(submissionDoc({ fatherOccupation: 'Indian Army Officer' }));
  assert.match(text, /Family Context: Defense family background/);
});

test('buildComprehensivePIQContext formats siblings as "name (age, occupation)" joined by "; "', () => {
  const text = buildComprehensivePIQContext(
    submissionDoc({
      siblings: [
        { name: 'Priya', age: '22', occupation: 'Student' },
        { name: 'Amit', age: '', occupation: '' }
      ]
    })
  );
  assert.match(text, /Siblings: Priya \(22, Student\); Amit \(age unknown, occupation unknown\)/);
});

test('buildComprehensivePIQContext formats education levels with Performance from percentage, falling back to CGPA', () => {
  const text = buildComprehensivePIQContext(
    submissionDoc({
      education10th: { institution: 'DPS', percentage: '92' },
      educationGraduation: { institution: 'DU', cgpa: '8.5' }
    })
  );
  assert.match(text, /10th Standard:[\s\S]*Institution: DPS[\s\S]*Performance: 92%/);
  assert.match(text, /Graduation:[\s\S]*Institution: DU[\s\S]*Performance: CGPA: 8.5/);
});

test('buildComprehensivePIQContext omits Post-Graduation entirely when its institution is blank', () => {
  const text = buildComprehensivePIQContext(submissionDoc({}));
  assert.doesNotMatch(text, /Post-Graduation/);
});

test('buildComprehensivePIQContext includes Post-Graduation when its institution is present', () => {
  const text = buildComprehensivePIQContext(submissionDoc({ educationPostGraduation: { institution: 'IIM' } }));
  assert.match(text, /Post-Graduation:[\s\S]*Institution: IIM/);
});

test('buildComprehensivePIQContext computes "Candidate Type" from previousInterviews length', () => {
  const zero = buildComprehensivePIQContext(submissionDoc({}));
  assert.match(zero, /Candidate Type: Fresh candidate - no prior SSB experience/);

  const one = buildComprehensivePIQContext(submissionDoc({ previousInterviews: [{ typeOfEntry: 'NDA', ssbPlace: 'Bhopal' }] }));
  assert.match(one, /Candidate Type: Repeater \(1 previous attempt\) - has SSB exposure/);

  const many = buildComprehensivePIQContext(
    submissionDoc({ previousInterviews: [{ typeOfEntry: 'NDA' }, { typeOfEntry: 'CDS' }] })
  );
  assert.match(many, /Candidate Type: Multiple attempts \(2\) - highly determined/);
});

test('buildComprehensivePIQContext emits an NCC personalization note only when hasTraining is true', () => {
  const withNcc = buildComprehensivePIQContext(submissionDoc({ nccTraining: { hasTraining: true, wing: 'Army', certificateObtained: 'C' } }));
  assert.match(withNcc, /-> Has NCC background \(Army Wing, C\) - explore leadership experiences/);

  const withoutNcc = buildComprehensivePIQContext(submissionDoc({ nccTraining: { hasTraining: false } }));
  assert.doesNotMatch(withoutNcc, /Has NCC background/);
});

test('buildComprehensivePIQContext emits a rural-background personalization note for small populations or "village"', () => {
  const byNumber = buildComprehensivePIQContext(submissionDoc({ maximumResidencePopulation: '8000' }));
  assert.match(byNumber, /-> Rural\/small town background/);

  const byKeyword = buildComprehensivePIQContext(submissionDoc({ maximumResidencePopulation: 'Small village near Pune' }));
  assert.match(byKeyword, /-> Rural\/small town background/);
});
