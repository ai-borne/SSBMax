/**
 * Phase 5: Server-Side Eligibility Enforcement Tests
 *
 * Runs via Node native test runner (node --test). Fakes the Firestore Admin
 * SDK transaction surface used by recordAndEnforce, matching the fake-db
 * pattern already established in oirScoring.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  bucketFor,
  fieldNameFor,
  limitFor,
  recordAndEnforce,
  currentYearMonth,
  currentPeriodKey,
  daysInMonth
} = require('../src/eligibility');

/**
 * In-memory fake standing in for admin.firestore(): supports the two doc
 * reads (tier + usage_{month}) and the one transactional set() eligibility
 * needs. Tracks writes so tests can assert exactly what was persisted.
 */
function makeFakeDb({ tier = 'FREE', startDate = null, usageDoc = null } = {}) {
  const writes = [];
  const state = { usage: usageDoc };

  function docForPath(segments) {
    const isTierDoc = segments[segments.length - 1] === 'subscription' && segments[segments.length - 2] === 'data';
    const isUsageDoc = segments[segments.length - 1].startsWith('usage_');
    return {
      async get() {
        if (isTierDoc) {
          return { exists: true, data: () => ({ tier, startDate }) };
        }
        if (isUsageDoc) {
          return { exists: state.usage !== null, data: () => state.usage };
        }
        return { exists: false, data: () => undefined };
      },
      set(value) {
        writes.push(value);
        state.usage = value;
      }
    };
  }

  function collection(path, segments = []) {
    const nextSegments = [...segments, path];
    return {
      doc(id) {
        const withDoc = [...nextSegments, id];
        return {
          ...docForPath(withDoc),
          collection: (sub) => collection(sub, withDoc)
        };
      }
    };
  }

  return {
    collection: (path) => collection(path),
    async runTransaction(fn) {
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, value) => ref.set(value)
      };
      return fn(tx);
    },
    _writes: writes
  };
}

test('Phase 5: bucketFor maps every TestType to its SubscriptionLimits bucket', () => {
  assert.equal(bucketFor('OIR').bucket, 'OIR');
  assert.equal(bucketFor('GTO_GD').bucket, 'GTO');
  assert.equal(bucketFor('GTO_CT').bucket, 'GTO');
  assert.equal(bucketFor('IO').bucket, 'INTERVIEW');
});

test('Phase 5: bucketFor throws invalid-argument for an unknown testType', () => {
  assert.throws(() => bucketFor('NOT_REAL'), (err) => {
    assert.equal(err.code, 'invalid-argument');
    return true;
  });
});

test('Phase 5: fieldNameFor derives the SubscriptionUsageDto field name from the bucket', () => {
  assert.equal(fieldNameFor('OIR'), 'oirTestsUsed');
  assert.equal(fieldNameFor('GTO'), 'gtoTestsUsed');
  assert.equal(fieldNameFor('INTERVIEW'), 'interviewTestsUsed');
});

test('Phase 5: limitFor reads the right tier column, -1 means unlimited', () => {
  const bucket = bucketFor('OIR');
  assert.equal(limitFor(bucket, 'FREE'), 1);
  assert.equal(limitFor(bucket, 'BASIC'), 5);
  assert.equal(limitFor(bucket, 'PRO'), 8);
  assert.equal(limitFor(bucket, 'PREMIUM'), 15);
  const piqBucket = bucketFor('PIQ');
  assert.equal(limitFor(piqBucket, 'PREMIUM'), -1);
});

test('Phase 5: exceeding quota rejects with resource-exhausted', async () => {
  process.env.ENFORCE_QUOTA = 'true';
  const db = makeFakeDb({ tier: 'PRO', usageDoc: { userId: 'u1', month: '2026-08', tatTestsUsed: 8, recordedSubmissionIds: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] } });
  await assert.rejects(
    () => recordAndEnforce(db, 'u1', 'TAT', 's9'),
    (err) => {
      assert.equal(err.code, 'resource-exhausted');
      return true;
    }
  );
  delete process.env.ENFORCE_QUOTA;
});

test('Phase 5: charging the same submissionId twice increments the counter once', async () => {
  const db = makeFakeDb({ tier: 'PRO', usageDoc: { userId: 'u1', month: '2026-08', tatTestsUsed: 1, recordedSubmissionIds: ['s1'] } });
  const first = await recordAndEnforce(db, 'u1', 'TAT', 's1');
  assert.equal(first.alreadyRecorded, true);
  assert.equal(first.used, 1);
  assert.equal(db._writes.length, 0, 'a duplicate submissionId must not write at all');
});

test('Phase 5: a fresh month with no usage doc starts counters at 1 on first charge', async () => {
  const db = makeFakeDb({ tier: 'PRO', usageDoc: null });
  const result = await recordAndEnforce(db, 'u2', 'WAT', 'first-submission');
  assert.equal(result.used, 1);
  assert.equal(db._writes.at(-1).watTestsUsed, 1);
  assert.deepEqual(db._writes.at(-1).recordedSubmissionIds, ['first-submission']);
});

test('Phase 5: ENFORCE_QUOTA=false logs but still allows the over-quota write through (rollback plan)', async () => {
  process.env.ENFORCE_QUOTA = 'false';
  try {
    const db = makeFakeDb({ tier: 'FREE', usageDoc: { userId: 'u3', month: '2026-08', tatTestsUsed: 0, recordedSubmissionIds: [] } });
    // FREE tier has 0 TAT quota -- would normally be blocked immediately.
    const result = await recordAndEnforce(db, 'u3', 'TAT', 'over-quota-submission');
    assert.equal(result.used, 1);
  } finally {
    delete process.env.ENFORCE_QUOTA;
  }
});

test('Phase 3: daysInMonth handles leap years and short months', () => {
  assert.equal(daysInMonth(2026, 1), 31);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29); // leap year
  assert.equal(daysInMonth(2026, 4), 30);
});

test('Phase 3: FREE tier always uses the legacy calendar-month key regardless of startDate', () => {
  const startDate = Date.UTC(2026, 0, 25); // Jan 25, 2026
  assert.equal(currentPeriodKey('FREE', startDate), currentYearMonth());
});

test('Phase 3: null startDate falls back to the legacy calendar-month key', () => {
  assert.equal(currentPeriodKey('PRO', null), currentYearMonth());
});

test('Phase 3: ENFORCE_ANNIVERSARY_RESET=false falls back to the legacy calendar-month key for every tier', () => {
  process.env.ENFORCE_ANNIVERSARY_RESET = 'false';
  try {
    const startDate = Date.UTC(2026, 0, 25);
    assert.equal(currentPeriodKey('PRO', startDate), currentYearMonth());
  } finally {
    delete process.env.ENFORCE_ANNIVERSARY_RESET;
  }
});

test('Phase 3: a day-31 anchor clamps to Feb 28 in a non-leap year', () => {
  const startDate = Date.UTC(2026, 0, 31); // Jan 31, 2026
  const realNow = Date;
  global.Date = class extends realNow {
    constructor(...args) {
      if (args.length === 0) return new realNow(Date.UTC(2026, 1, 28)); // "now" = Feb 28, 2026
      return new realNow(...args);
    }
    static now() {
      return realNow.UTC(2026, 1, 28);
    }
  };
  try {
    assert.equal(currentPeriodKey('PRO', startDate), '2026-02-28');
  } finally {
    global.Date = realNow;
  }
});

test('Phase 3: recordAndEnforce writes to the anniversary-keyed usage doc for a paid tier with a startDate', async () => {
  const startDate = Date.UTC(2026, 5, 25); // Jun 25, 2026
  const db = makeFakeDb({ tier: 'PRO', startDate, usageDoc: null });
  const result = await recordAndEnforce(db, 'u5', 'TAT', 'first-submission');
  assert.equal(result.used, 1);
  const period = currentPeriodKey('PRO', startDate);
  assert.equal(db._writes.at(-1).month, period);
  // A paid tier with a real startDate must not collide with the legacy calendar-month key.
  assert.notEqual(period, currentYearMonth());
});

test('Phase 5: GTO sub-types share one bucket -- GTO_GD usage counts against GTO_CT quota', async () => {
  const db = makeFakeDb({
    tier: 'PRO',
    usageDoc: { userId: 'u4', month: '2026-08', gtoTestsUsed: 8, recordedSubmissionIds: ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'] }
  });
  await assert.rejects(
    () => recordAndEnforce(db, 'u4', 'GTO_CT', 'g9'),
    (err) => {
      assert.equal(err.code, 'resource-exhausted');
      return true;
    }
  );
});
