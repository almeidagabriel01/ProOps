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
export { updateMemberPermissions } from "./updateMemberPermissions";
export { deleteMember } from "./deleteMember";
export { updateMember } from "./updateMember";

