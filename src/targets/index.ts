export { TargetService } from './TargetService';
export type { FileGateway } from './FileGateway';
export type { CanvasOutlineEntry, CanvasOutlineSyncResult } from './CanvasTargetAdapter';
export type { TargetBacklink, TargetCardOptions, TargetWriteResult } from './TargetTypes';
export { parseMarkdownBacklink } from './MarkdownTargetAdapter';
export { UnsupportedExcalidrawFormatError } from './ExcalidrawTargetAdapter';

export type { TargetServiceOptions } from './TargetService';
export type { TargetRepairDiagnostic, TargetReconciliationResult, TargetWriteRecoveryResult } from './TargetRepair';
export { TargetRepairError } from './TargetRepair';
export { DEFAULT_EXCERPT_TEMPLATE, EXCERPT_TEMPLATE_PLACEHOLDERS, excerptTemplateValues, previewExcerptTemplate, renderExcerptTemplate } from './ExcerptTemplate';
export type { ExcerptTemplateValues, ExcerptTemplatePreview } from './ExcerptTemplate';
