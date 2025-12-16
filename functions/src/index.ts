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
 */

export { createMember } from "./createMember";
export { createProposal } from "./createProposal";
