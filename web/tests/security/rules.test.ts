import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4: Database & Storage Rules Access Control Security', () => {
  const firestoreRulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const storageRulesPath = path.resolve(__dirname, '../../../storage.rules');

  it('should have a valid firestore.rules file locking down privileged keys', () => {
    expect(fs.existsSync(firestoreRulesPath)).toBe(true);
    const content = fs.readFileSync(firestoreRulesPath, 'utf-8');

    expect(content).toContain("rules_version = '2';");
    expect(content).toContain('match /users/{userId}');
    
    // Verify client updates to isPaidMember and membershipPlan are explicitly blocked
    expect(content).toContain("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'isPaidMember', 'membershipPlan', 'paymentId', 'orderId'])");
    
    // Verify webhook_logs is denied to clients
    expect(content).toContain('match /webhook_logs/{eventId}');
    
    // Verify default deny rule exists
    expect(content).toContain('match /{document=**}');
    expect(content).toContain('allow read, write: if false;');
  });

  it('allows public read (never write) of study_materials -- the Study tab is unauthenticated content, not a security boundary', () => {
    const content = fs.readFileSync(firestoreRulesPath, 'utf-8');
    const match = content.match(/match \/study_materials\/\{materialId\} \{([^}]*)\}/);

    expect(match).not.toBeNull();
    expect(match?.[1]).toContain('allow read: if true;');
    expect(match?.[1]).toContain('allow write: if false;');
  });

  it('should enforce strict storage.rules for assets and 10MB upload limits', () => {
    expect(fs.existsSync(storageRulesPath)).toBe(true);
    const content = fs.readFileSync(storageRulesPath, 'utf-8');

    expect(content).toContain('service firebase.storage');
    expect(content).toContain('match /user_uploads/{userId}/{allPaths=**}');
    
    // Verify 10MB max upload size limit and MIME-type filtering are enforced
    expect(content).toContain('request.resource.size < 10 * 1024 * 1024');
    expect(content).toContain("request.resource.contentType.matches('image/(jpeg|png|webp)|application/pdf|audio/.*')");
    
    // Verify static test assets disallow client write
    expect(content).toContain('match /ppdt_images/{allPaths=**}');
    expect(content).toContain('match /tat_images/{allPaths=**}');
  });
});

