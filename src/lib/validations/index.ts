// ============================================
// VALIDATION SCHEMAS - CENTRAL EXPORT
// ============================================

// Customer
export {
  customerSchema,
  customerFieldSchemas,
  type CustomerFormData,
} from "./customer";

// Product
export {
  productSchema,
  productFieldSchemas,
  serviceSchema,
  type ProductFormData,
  type ServiceFormData,
} from "./product";

// Transaction
export {
  transactionSchema,
  transactionFieldSchemas,
  type TransactionFormData,
} from "./transaction";

// Proposal
export {
  proposalSchema,
  proposalFieldSchemas,
  type ProposalFormData,
} from "./proposal";

// Auth
export {
  loginSchema,
  loginFieldSchemas,
  registerSchema,
  registerFieldSchemas,
  type LoginFormData,
  type RegisterFormData,
} from "./auth";

// Team
export {
  teamMemberSchema,
  teamMemberFieldSchemas,
  type TeamMemberFormData,
} from "./team";
