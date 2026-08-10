import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo } from '../../types/testContent';

export interface IContentRepository {
  getStudyMaterials(): Promise<StudyMaterial[]>;
  getStudyMaterialById(id: string): Promise<StudyMaterial | null>;
  getOIRQuestions(batchIndex?: number): Promise<BatchDocument<OIRQuestion>>;
  getPPDTContext(id?: string): Promise<PPDTContext>;
  getTATSet(id?: string): Promise<TATSet>;
  getWATBatch(id?: string): Promise<WATBatch>;
  getSRTBatch(id?: string): Promise<SRTBatch>;
  getCappedBatch<T>(collectionName: string, batchIndex?: number, maxItems?: number): Promise<BatchDocument<T>>;
  getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]>;
}

