export interface DiagnosticProfile {
  targetBoard: 'army' | 'navy' | 'airforce';
  entryStream: 'nda' | 'cds' | 'afcat' | 'tes_tgc' | 'ncc';
  prepLevel: 'beginner' | 'intermediate' | 'advanced';
  targetMonth?: string;
  isCompleted: boolean;
}
