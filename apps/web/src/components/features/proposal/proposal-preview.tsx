// Re-export from refactored module for backward compatibility
export { ProposalPreview } from "./preview/proposal-preview";
export { PreviewSection } from "./preview/preview-section";
export {
  parseContent,
  getTextStyleObj,
  ProductTableSection,
  CustomTableSection,
  CustomFieldBlock,
  HierarchicalFieldBlock,
} from "./preview/section-renderers";
export type { TableItem } from "./preview/section-renderers";
