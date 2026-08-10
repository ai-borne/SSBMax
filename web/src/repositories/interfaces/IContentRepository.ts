import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo } from '../../types/testContent';

export interface IContentRepository {
  getStudyMaterials(): Promise<StudyMaterial[]>;
  getStudyMaterialById(id: string): Promise<StudyMaterial | null>;
  getOIRQuestions(batchIndex?: number): Promise<BatchDocument<OIRQuestion>>;
  getPPDTContext(id?: string): Promise<PPDTContext>;
  getTATSet(id?: string): Promise<TATSet>;
  getWATBatch(id?: string): Promise<WATBatch>;
  getSRTBatch(id?: string): Promise<SRTBatch>;
  getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]>;
}

