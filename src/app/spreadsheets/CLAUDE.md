# CLAUDE.md — src/app/spreadsheets/

## Propósito e contexto de negócio

Módulo de planilhas internas do tenant. Permite criar, importar (Excel/CSV), editar e excluir planilhas livres — sem relação direta com propostas ou lançamentos. Serve como área de trabalho para cálculos, orçamentos internos e organização de dados.

O editor utiliza **UniverJS** (`@univerjs/presets`), uma engine de planilhas open-source compatível com o formato do Excel.

## Quem pode acessar

Usuários autenticados com tenant ativo. Superadmin sem tenant selecionado vê o estado `SelectTenantState`.

Não há granularidade fina por permissão (qualquer usuário do tenant pode criar/editar/excluir).

## Estrutura de rotas

```
spreadsheets/
├── page.tsx              # Listagem de planilhas
├── loading.tsx           # Skeleton de loading
├── _components/
│   ├── spreadsheets-skeleton.tsx       # Skeleton da página de listagem
│   └── spreadsheets-table-skeleton.tsx # Skeleton da tabela
└── [id]/
    ├── page.tsx          # Editor UniverJS
    ├── loading.tsx
    └── _components/
        └── spreadsheet-editor-skeleton.tsx
```

## Arquivos-chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `spreadsheets/page.tsx` | Lista paginada (cursor-based), busca, criar nova, importar Excel, excluir |
| `spreadsheets/[id]/page.tsx` | Editor UniverJS com auto-save e renomeação inline |
| `src/services/spreadsheet-service.ts` | CRUD completo + paginação cursor Firestore |
| `src/lib/spreadsheet-import.ts` | Conversão de arquivo Excel/CSV para formato Univer |
| `src/lib/univer-pt-br.ts` | Locale pt-BR para o UniverJS |

## Modelo de dados

```typescript
// src/services/spreadsheet-service.ts
type Spreadsheet = {
  id: string;
  tenantId: string;
  name: string;
  data: SpreadsheetData;        // objeto UniverWorkbookData em memória
  dataFormat?: SpreadsheetDataFormat; // sempre "univer"
  dataJson?: string;            // serialização JSON do workbook (campo gravado no Firestore)
  createdAt?: string;
  updatedAt?: string;
};
```

**Importante:** o conteúdo da planilha é armazenado no Firestore como string JSON no campo `dataJson`. O campo `data` (objeto) é apenas representação em memória. Ao ler, `SpreadsheetService` faz o parse de `dataJson` e normaliza para o tipo `SpreadsheetData`.

### Formato Univer
O workbook segue o esquema `UniverWorkbookData` da biblioteca `@univerjs/presets`. Campos relevantes:
- `name` — nome do workbook (exibido no editor e na listagem)
- `locale` — locale do UniverJS (usa `DEFAULT_SPREADSHEET_LOCALE` = `es-ES` customizado com strings pt-BR)

O locale está setado para `es-ES` porque o UniverJS usa esse como base para currencies latinas, mas as strings são substituídas por pt-BR via `univerPtBrLocale`.

## Chamadas de API / serviços

| Operação | Método | Endpoint |
|----------|--------|----------|
| Listar paginado | `GET` Firestore (direto) | coleção `spreadsheets` |
| Listar todos (busca) | `GET` Firestore (direto) | coleção `spreadsheets` |
| Buscar por ID | `GET` Firestore (direto) | doc `spreadsheets/:id` |
| Criar | `POST` via `callApi` | `/v1/spreadsheets` |
| Atualizar | `PUT` via `callApi` | `/v1/spreadsheets/:id` |
| Excluir | `DELETE` via `callApi` | `/v1/spreadsheets/:id` |

**Padrão dual:** leituras vão direto ao Firestore (client SDK). Escritas passam pelo backend (`callApi`). Em ambiente não-produção há fallback para Firestore direto caso a API falhe (útil em desenvolvimento com emuladores sem backend rodando).

```typescript
// Exemplo do fallback em dev
try {
  await callApi(`/v1/spreadsheets/${id}`, "DELETE");
  return;
} catch (apiError) {
  if (process.env.NODE_ENV === "production") throw apiError;
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}
```

## Integração com outros módulos

- Não há integração direta com outros módulos (propostas, lançamentos, CRM)
- A importação de Excel usa `src/lib/spreadsheet-import.ts` + `importExcelFileToSpreadsheetData(file)` para converter `File` → `UniverWorkbookData`
- Formatos aceitos: definidos em `SUPPORTED_SPREADSHEET_ACCEPT` (`.xlsx`, `.xls`, `.csv`)

## Padrões e gotchas

### Paginação da listagem
A listagem usa o componente `DataTable` com `fetchPage` cursor-based (Firestore `startAfter`). Página de 12 itens. Quando o usuário filtra por texto, busca todos os documentos de uma vez e filtra localmente — troca entre os dois modos é transparente para o usuário.

### Editor UniverJS — ciclo de vida
O editor (`[id]/page.tsx`) cria a instância UniverJS via `createUniver()` em um `useEffect`. A instância é destruída no cleanup (`dispose()`). O auto-save usa debounce sobre os eventos `SheetEditEnded` e `CommandExecuted` da API do Univer.

**Cuidado ao alterar `[id]/page.tsx`:** o UniverJS precisa de um elemento DOM `<div>` existente no momento do `createUniver()`. Renderização condicional que remova esse div causará erro.

### Currency symbol
O símbolo de moeda para o locale `es-ES` é sobrescrito para `R$`:
```typescript
localeCurrencySymbolMap.set(LocaleType.ES_ES, "R$");
```
Isso deve ser feito antes da criação do workbook.

### Skeleton / flash de conteúdo
A listagem usa dois flags (`hasAnySheets` + `isTableLoading`) para decidir quando exibir o skeleton e evitar flash do estado vazio antes da primeira carga. Não simplificar essa lógica sem testar o comportamento visual.

### Importação: limpeza do input
Após processar o arquivo importado, o value do `<input type="file">` é zerado manualmente (`event.target.value = ""`). Isso permite reimportar o mesmo arquivo.
