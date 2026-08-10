'use strict';

const { header, ALL_SOURCE_FILES } = require('./header');

function ktString(s) {
  return JSON.stringify(String(s));
}

function emitKotlin(data) {
  const { firestorePaths, enums, subscription, testConfig, events, routes } = data;
  const out = [];
  out.push(header('kt', ALL_SOURCE_FILES));
  out.push('package com.ssbmax.shared.contracts');
  out.push('');
  out.push('object SsbContracts {');
  out.push('');

  // Firestore paths
  out.push('    object FirestorePaths {');
  for (const c of firestorePaths.collections) {
    out.push(`        const val ${c.name} = ${ktString(c.path)}`);
  }
  out.push('');
  out.push('        object TestContent {');
  for (const tc of firestorePaths.testContent) {
    out.push(`            const val ${tc.testType}_BATCHES = ${ktString(tc.batchesPath)}`);
    if (tc.metaConfigPath) {
      out.push(`            const val ${tc.testType}_META_CONFIG = ${ktString(tc.metaConfigPath)}`);
    }
  }
  out.push('        }');
  out.push('    }');
  out.push('');

  // Enums
  out.push('    object Enums {');
  for (const e of enums.enums) {
    const isObjectMembers = e.members.length > 0 && typeof e.members[0] === 'object' && e.members[0] !== null;
    if (!isObjectMembers) {
      out.push(`        enum class ${e.name} { ${e.members.join(', ')} }`);
    } else {
      out.push(`        enum class ${e.name}(val displayName: String, val category: String, val critical: Boolean) {`);
      const rows = e.members.map((m) => `            ${m.id}(${ktString(m.displayName)}, ${ktString(m.category)}, ${m.critical ? 'true' : 'false'})`);
      out.push(rows.join(',\n') + ';');
      out.push('        }');
    }
  }
  out.push('    }');
  out.push('');

  // Subscription limits
  out.push('    data class SubscriptionLimit(val bucket: String, val testTypes: List<String>, val free: Int, val pro: Int, val premium: Int)');
  out.push('    object Subscription {');
  out.push('        val LIMITS: List<SubscriptionLimit> = listOf(');
  const subRows = subscription.limits.map((l) => {
    const types = l.testTypes.map((t) => `"${t}"`).join(', ');
    return `            SubscriptionLimit(${ktString(l.bucket)}, listOf(${types}), ${l.FREE}, ${l.PRO}, ${l.PREMIUM})`;
  });
  out.push(subRows.join(',\n'));
  out.push('        )');
  out.push('    }');
  out.push('');

  // Test config
  out.push('    data class TestConfigEntry(val testType: String, val values: Map<String, Any>)');
  out.push('    object TestConfig {');
  out.push('        val ENTRIES: List<TestConfigEntry> = listOf(');
  const tcRows = testConfig.tests.map((t) => {
    const values = Object.entries(t).filter(([k]) => !['testType', 'source', 'note'].includes(k));
    const mapEntries = values.map(([k, v]) => `"${k}" to ${typeof v === 'string' ? ktString(v) : v}`).join(', ');
    return `            TestConfigEntry(${ktString(t.testType)}, mapOf(${mapEntries}))`;
  });
  out.push(tcRows.join(',\n'));
  out.push('        )');
  out.push('    }');
  out.push('');

  // Events
  out.push('    object SecurityEvents {');
  for (const ev of events.securityEvents) {
    out.push(`        const val ${ev.name} = ${ktString(ev.value)}`);
  }
  out.push('    }');
  out.push('');

  // Routes
  out.push('    object Routes {');
  out.push(`        const val MINIMUM_SUPPORTED_APP_VERSION = ${ktString(routes.minimumSupportedAppVersion)}`);
  for (const r of routes.routes) {
    out.push(`        const val ${r.name} = ${ktString(r.path)}`);
  }
  out.push('    }');
  out.push('}');
  out.push('');

  return out.join('\n');
}

module.exports = { emitKotlin };
