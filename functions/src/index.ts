/**
 * Firebase Cloud Functions - Index
 * 
 * Export all Cloud Functions from this file.
 * 
 * DEPLOYMENT:
 * firebase deploy --only functions
 * 
 * INDIVIDUAL DEPLOYMENT:
 * firebase deploy --only functions:createMember
 * firebase deploy --only functions:createProposal
 * firebase deploy --only functions:updateMemberPermissions
 */

export { createMember } from "./createMember";
export { createProposal } from "./createProposal";
export { updateProposal } from "./updateProposal";
export { deleteProposal } from "./deleteProposal";
export { updateMemberPermissions } from "./updateMemberPermissions";
export { deleteMember } from "./deleteMember";
export { updateMember } from "./updateMember";

export { createClient } from "./createClient";
export { updateClient } from "./updateClient";
export { deleteClient } from "./deleteClient";
export { createProduct } from "./createProduct";
export { updateProduct } from "./updateProduct";
export { deleteProduct } from "./deleteProduct";

// Transaction Functions
export { createTransaction, updateTransaction, deleteTransaction } from "./transactionFunctions";

// Auxiliary Functions (Config Data)
export {
  createAmbiente, updateAmbiente, deleteAmbiente,
  createSistema, updateSistema, deleteSistema,
  createCustomField, updateCustomField, deleteCustomField,
  createOption, updateOption, deleteOption,
  createProposalTemplate, updateProposalTemplate, deleteProposalTemplate,
} from "./auxiliaryFunctions";
