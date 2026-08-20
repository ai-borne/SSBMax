import { StudyMaterial, OIRQuestion, PPDTContext, TATSet, WATBatch, SRTBatch, BatchDocument, TestBatchInfo, GPEImage, OIRContentMeta } from '../../types/testContent';

export interface IContentRepository {
  getStudyMaterials(): Promise<StudyMaterial[]>;
  getStudyMaterialById(id: string): Promise<StudyMaterial | null>;
  getOIRQuestions(batchIndex?: number): Promise<BatchDocument<OIRQuestion>>;
  getPPDTContext(id?: string): Promise<PPDTContext>;
  getTATSet(id?: string): Promise<TATSet>;
  getWATBatch(id?: string): Promise<WATBatch>;
  getSRTBatch(id?: string): Promise<SRTBatch>;
  getGPEBatch(id?: string, batchIndex?: number): Promise<BatchDocument<GPEImage>>;
  getOIRContentVersion(): Promise<OIRContentMeta>;
  getAvailableBatches(moduleName: string): Promise<TestBatchInfo[]>;
}

