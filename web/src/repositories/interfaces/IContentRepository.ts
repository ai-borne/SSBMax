import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo, GPEImage, OIRContentMeta } from '../../types/testContent';
import type { DocumentModel } from '../../components/content/blocks/types';

export interface IContentRepository {
  getStudyMaterials(): Promise<StudyMaterial[]>;
  getStudyMaterialById(id: string): Promise<StudyMaterial | null>;
  /**
   * D2 side document `study_material_sections/{id}` (Phase 5, docs/plans/
   * write-the-phased-plan-wobbly-pancake.md) -- null when no side document has been published
   * for this material yet, or on any fetch/decode error; callers must fall back to
   * `StudyMaterial.contentMarkdown` in that case, never render blank.
   */
  getStudyMaterialSections(id: string): Promise<DocumentModel | null>;
  getOIRQuestions(batchIndex?: number): Promise<BatchDocument<OIRQuestion>>;
  getPPDTContext(id?: string): Promise<PPDTContext>;
  getTATSet(id?: string): Promise<TATSet>;
  getWATBatch(id?: string): Promise<WATBatch>;
  getSRTBatch(id?: string): Promise<SRTBatch>;
  getGPEBatch(id?: string, batchIndex?: number): Promise<BatchDocument<GPEImage>>;
  getOIRContentVersion(): Promise<OIRContentMeta>;
  getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]>;
}

