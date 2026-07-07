/**
 * Réplica runtime-local do enum SchemaType de @google/generative-ai.
 *
 * Os valores são idênticos (nomes de tipo JSON-schema em lowercase); o cast
 * type-only mantém as tipagens de FunctionDeclaration funcionando, mas o
 * módulo do SDK nunca é carregado em runtime — @google/generative-ai vive em
 * devDependencies (só tipos no build). Ganho direto de cold start: um SDK
 * Google AI a menos no boot do monolito.
 */
export const SchemaType = {
  STRING: "string",
  NUMBER: "number",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  ARRAY: "array",
  OBJECT: "object",
} as unknown as typeof import("@google/generative-ai").SchemaType;
