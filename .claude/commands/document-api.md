# /document-api

Gero documentação de uma API route ou Cloud Function.

## Como usar
Informe o path do arquivo ou o nome da rota. Ex:
- `/document-api functions/src/api/controllers/proposals.controller.ts`
- `/document-api POST /proposals`

## O que vou fazer

1. Ler o arquivo da route/controller
2. Identificar: método, path, autenticação requerida, request body, response, status codes
3. Gerar documentação no formato abaixo

## Formato de saída

```markdown
## [MÉTODO] /api/[path]

**Autenticação:** Sim (Bearer token Firebase) / Não
**Roles permitidos:** admin / master / member / todos

**Request Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| campo | string | Sim | Descrição |

**Response (200):**
```json
{
  "campo": "valor"
}
```

**Erros:**
| Status | Código | Motivo |
|--------|--------|--------|
| 400 | INVALID_INPUT | Campo obrigatório ausente |
| 401 | UNAUTHORIZED | Token inválido ou ausente |
| 403 | FORBIDDEN | Sem permissão para este recurso |
| 404 | NOT_FOUND | Recurso não encontrado |
| 500 | INTERNAL_ERROR | Erro interno do servidor |

**Notas:**
- Filtra automaticamente por `tenantId` do token
- [outras observações relevantes]
```

## Onde salvar
Se o usuário quiser persistir: `docs/api/[nome].md`
(criar o diretório `docs/api/` se não existir)
