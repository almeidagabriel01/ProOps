import type { SpreadsheetData } from "@/types";
import type {
  Alignment as ExcelAlignment,
  Border as ExcelBorderEdge,
  Borders as ExcelBorders,
  Cell as ExcelCell,
  CellValue as ExcelCellValue,
  Color as ExcelColor,
  Fill as ExcelFill,
  Font as ExcelFont,
  Workbook as ExcelWorkbook,
  Worksheet as ExcelWorksheet,
} from "exceljs";
import type {
  CellObject,
  ColInfo,
  Range as SheetRange,
  RowInfo,
  WorkBook,
  WorkSheet,
} from "xlsx";
import { DEFAULT_SPREADSHEET_LOCALE } from "@/lib/univer-pt-br";

const UNIVER_APP_VERSION = "0.11.0";
const UNIVER_LOCALE = DEFAULT_SPREADSHEET_LOCALE;

export const SUPPORTED_SPREADSHEET_EXTENSIONS = [
  "xlsx",
  "xls",
  "xlsm",
  "xlsb",
  "xltx",
  "xltm",
  "csv",
  "txt",
  "tsv",
  "xml",
  "dif",
  "slk",
  "prn",
  "ods",
  "fods",
] as const;

export const SUPPORTED_SPREADSHEET_ACCEPT = [
  ".xlsx",
  ".xls",
  ".xlsm",
  ".xlsb",
  ".xltx",
  ".xltm",
  ".csv",
  ".txt",
  ".tsv",
  ".xml",
  ".dif",
  ".slk",
  ".prn",
  ".ods",
  ".fods",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template",
  "application/vnd.ms-excel.template.macroEnabled.12",
  "text/csv",
  "text/plain",
].join(",");

const STYLED_EXCEL_EXTENSIONS = new Set(["xlsx", "xlsm", "xltx", "xltm"]);
const TEXT_BASED_EXTENSIONS = new Set([
  "csv",
  "txt",
  "tsv",
  "dif",
  "slk",
  "prn",
]);
const SUPPORTED_SPREADSHEET_EXTENSION_SET = new Set<string>(
  SUPPORTED_SPREADSHEET_EXTENSIONS,
);

const BOOLEAN_FALSE = 0;
const BOOLEAN_TRUE = 1;

const CELL_TYPE_STRING = 1;
const CELL_TYPE_NUMBER = 2;
const CELL_TYPE_BOOLEAN = 3;

const HORIZONTAL_ALIGN_LEFT = 1;
const HORIZONTAL_ALIGN_CENTER = 2;
const HORIZONTAL_ALIGN_RIGHT = 3;
const HORIZONTAL_ALIGN_JUSTIFIED = 4;
const HORIZONTAL_ALIGN_DISTRIBUTED = 6;

const VERTICAL_ALIGN_TOP = 1;
const VERTICAL_ALIGN_MIDDLE = 2;
const VERTICAL_ALIGN_BOTTOM = 3;

const WRAP_STRATEGY_WRAP = 3;

const BORDER_STYLE_NONE = 0;
const BORDER_STYLE_THIN = 1;
const BORDER_STYLE_HAIR = 2;
const BORDER_STYLE_DOTTED = 3;
const BORDER_STYLE_DASHED = 4;
const BORDER_STYLE_DASH_DOT = 5;
const BORDER_STYLE_DASH_DOT_DOT = 6;
const BORDER_STYLE_DOUBLE = 7;
const BORDER_STYLE_MEDIUM = 8;
const BORDER_STYLE_MEDIUM_DASHED = 9;
const BORDER_STYLE_MEDIUM_DASH_DOT = 10;
const BORDER_STYLE_MEDIUM_DASH_DOT_DOT = 11;
const BORDER_STYLE_SLANT_DASH_DOT = 12;
const BORDER_STYLE_THICK = 13;

const TEXT_DECORATION_SINGLE = 12;

const DEFAULT_WORKSHEET_ROW_COUNT = 1000;
const DEFAULT_WORKSHEET_COLUMN_COUNT = 20;
const DEFAULT_WORKSHEET_ROW_HEIGHT = 24;
const DEFAULT_WORKSHEET_COLUMN_WIDTH = 88;
const DEFAULT_ROW_HEADER_WIDTH = 46;
const DEFAULT_COLUMN_HEADER_HEIGHT = 20;
const DEFAULT_FONT_NAME = "Calibri";
const DEFAULT_FONT_SIZE = 11;
const DEFAULT_FONT_COLOR = "#000000";

const EXCEL_THEME_COLORS = [
  "#FFFFFF",
  "#000000",
  "#EEECE1",
  "#1F497D",
  "#4F81BD",
  "#C0504D",
  "#9BBB59",
  "#8064A2",
  "#4BACC6",
  "#F79646",
];

const EXCEL_INDEXED_COLORS: Record<number, string> = {
  0: "#000000",
  1: "#FFFFFF",
  2: "#FF0000",
  3: "#00FF00",
  4: "#0000FF",
  5: "#FFFF00",
  6: "#FF00FF",
  7: "#00FFFF",
  8: "#000000",
  9: "#FFFFFF",
  10: "#FF0000",
  11: "#00FF00",
  12: "#0000FF",
};

type UniverColor = {
  rgb: string;
};

type UniverBorderStyle = {
  s: number;
  cl: UniverColor;
};

type UniverStyle = {
  ff?: string;
  fs?: number;
  it?: number;
  bl?: number;
  ul?: { s: number; t: number };
  st?: { s: number; t: number };
  bg?: UniverColor;
  bd?: {
    t?: UniverBorderStyle;
    r?: UniverBorderStyle;
    b?: UniverBorderStyle;
    l?: UniverBorderStyle;
  };
  cl?: UniverColor;
  n?: {
    pattern: string;
  };
  ht?: number;
  vt?: number;
  tb?: number;
};

type UniverCell = {
  v?: string | number | boolean;
  t?: number;
  f?: string;
  s?: string;
};

type UniverWorksheet = {
  id: string;
  name: string;
  tabColor: string;
  hidden: number;
  freeze: {
    xSplit: number;
    ySplit: number;
    startRow: number;
    startColumn: number;
  };
  rowCount: number;
  columnCount: number;
  zoomRatio: number;
  scrollTop: number;
  scrollLeft: number;
  defaultColumnWidth: number;
  defaultRowHeight: number;
  mergeData: Array<{
    startRow: number;
    startColumn: number;
    endRow: number;
    endColumn: number;
  }>;
  cellData: Record<number, Record<number, UniverCell>>;
  rowData: Record<number, { h?: number; hd?: number }>;
  columnData: Record<number, { w?: number; hd?: number }>;
  showGridlines: number;
  rowHeader: {
    width: number;
    hidden: number;
  };
  columnHeader: {
    height: number;
    hidden: number;
  };
  rightToLeft: number;
};

type StyleRegistry = {
  nextId: number;
  byKey: Map<string, string>;
  styles: Record<string, UniverStyle>;
};

const normalizeWorkbookName = (fileName: string): string => {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim();
  return baseName.length > 0 ? baseName : "Planilha Importada";
};

const normalizeSheetName = (
  inputName: string | undefined,
  index: number,
  usedNames: Set<string>,
): string => {
  const fallbackBaseName = `Planilha ${index + 1}`;
  const baseName = String(inputName || "").trim() || fallbackBaseName;

  let nextName = baseName;
  let suffix = 2;

  while (usedNames.has(nextName)) {
    nextName = `${baseName} (${suffix})`;
    suffix += 1;
  }

  usedNames.add(nextName);
  return nextName;
};

const buildEmptyWorksheet = (
  sheetId: string,
  sheetName: string,
  rowCount: number,
  columnCount: number,
): UniverWorksheet => ({
  id: sheetId,
  name: sheetName,
  tabColor: "",
  hidden: BOOLEAN_FALSE,
  freeze: {
    xSplit: 0,
    ySplit: 0,
    startRow: -1,
    startColumn: -1,
  },
  rowCount,
  columnCount,
  zoomRatio: 1,
  scrollTop: 0,
  scrollLeft: 0,
  defaultColumnWidth: DEFAULT_WORKSHEET_COLUMN_WIDTH,
  defaultRowHeight: DEFAULT_WORKSHEET_ROW_HEIGHT,
  mergeData: [],
  cellData: {},
  rowData: {},
  columnData: {},
  showGridlines: BOOLEAN_TRUE,
  rowHeader: {
    width: DEFAULT_ROW_HEADER_WIDTH,
    hidden: BOOLEAN_FALSE,
  },
  columnHeader: {
    height: DEFAULT_COLUMN_HEADER_HEIGHT,
    hidden: BOOLEAN_FALSE,
  },
  rightToLeft: BOOLEAN_FALSE,
});

const createStyleRegistry = (): StyleRegistry => ({
  nextId: 1,
  byKey: new Map<string, string>(),
  styles: {},
});

const toColumnIndex = (columnReference: string): number => {
  let result = 0;

  for (const char of columnReference.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }

  return result - 1;
};

const decodeCellReference = (
  reference: string,
): { row: number; column: number } => {
  const match = reference.match(/^([A-Z]+)(\d+)$/i);

  if (!match) {
    throw new Error(`Referencia de celula invalida: ${reference}`);
  }

  return {
    column: toColumnIndex(match[1]),
    row: Number(match[2]) - 1,
  };
};

const decodeRangeReference = (reference: string): SheetRange => {
  const [startRef, endRef] = reference.split(":");
  const start = decodeCellReference(startRef);
  const end = decodeCellReference(endRef || startRef);

  return {
    s: { c: start.column, r: start.row },
    e: { c: end.column, r: end.row },
  };
};

const getCellDisplayValue = (cell: CellObject): string => {
  if (typeof cell.w === "string" && cell.w.trim().length > 0) {
    return cell.w;
  }

  if (cell.v instanceof Date) {
    return cell.v.toISOString();
  }

  if (cell.v === null || typeof cell.v === "undefined") {
    return "";
  }

  return String(cell.v);
};

const convertGenericCell = (cell: CellObject): UniverCell | null => {
  const nextCell: UniverCell = {};
  const cellType = String(cell.t || "");

  if (typeof cell.f === "string" && cell.f.trim().length > 0) {
    nextCell.f = `=${cell.f.trim()}`;
  }

  if (cellType === "b") {
    nextCell.v = Boolean(cell.v);
    nextCell.t = CELL_TYPE_BOOLEAN;
  } else if (cellType === "n" && typeof cell.v === "number") {
    nextCell.v = cell.v;
    nextCell.t = CELL_TYPE_NUMBER;
  } else if (cellType === "d") {
    nextCell.v = getCellDisplayValue(cell);
    nextCell.t = CELL_TYPE_STRING;
  } else if (cellType === "s" || cellType === "str" || cellType === "e") {
    nextCell.v = getCellDisplayValue(cell);
    nextCell.t = CELL_TYPE_STRING;
  } else if (typeof cell.v === "string") {
    nextCell.v = cell.v;
    nextCell.t = CELL_TYPE_STRING;
  } else if (typeof cell.v === "boolean") {
    nextCell.v = cell.v;
    nextCell.t = CELL_TYPE_BOOLEAN;
  } else if (typeof cell.v === "number") {
    nextCell.v = cell.v;
    nextCell.t = CELL_TYPE_NUMBER;
  }

  if (!nextCell.f && typeof nextCell.v === "undefined") {
    return null;
  }

  return nextCell;
};

const convertMerges = (merges: SheetRange[] | undefined) =>
  (merges || []).map((merge) => ({
    startRow: merge.s.r,
    startColumn: merge.s.c,
    endRow: merge.e.r,
    endColumn: merge.e.c,
  }));

const convertRows = (rows: RowInfo[] | undefined) => {
  const rowData: Record<number, { h?: number; hd?: number }> = {};

  (rows || []).forEach((row, index) => {
    if (!row) {
      return;
    }

    const nextRow: { h?: number; hd?: number } = {};

    if (typeof row.hpx === "number" && row.hpx > 0) {
      nextRow.h = Math.round(row.hpx);
    } else if (typeof row.hpt === "number" && row.hpt > 0) {
      nextRow.h = Math.round(row.hpt * (96 / 72));
    }

    if (row.hidden) {
      nextRow.hd = BOOLEAN_TRUE;
    }

    if (Object.keys(nextRow).length > 0) {
      rowData[index] = nextRow;
    }
  });

  return rowData;
};

const resolveGenericColumnWidth = (column: ColInfo): number | undefined => {
  if (typeof column.wpx === "number" && column.wpx > 0) {
    return Math.round(column.wpx);
  }

  if (typeof column.wch === "number" && column.wch > 0) {
    return Math.round(column.wch * 8 + 16);
  }

  return undefined;
};

const convertColumns = (columns: ColInfo[] | undefined) => {
  const columnData: Record<number, { w?: number; hd?: number }> = {};

  (columns || []).forEach((column, index) => {
    if (!column) {
      return;
    }

    const nextColumn: { w?: number; hd?: number } = {};
    const width = resolveGenericColumnWidth(column);

    if (typeof width === "number") {
      nextColumn.w = width;
    }

    if (column.hidden) {
      nextColumn.hd = BOOLEAN_TRUE;
    }

    if (Object.keys(nextColumn).length > 0) {
      columnData[index] = nextColumn;
    }
  });

  return columnData;
};

const getWorksheetBounds = (
  workbookSheet: WorkSheet,
  decodeRange: (range: string) => SheetRange,
): { rowCount: number; columnCount: number } => {
  const ref = workbookSheet["!ref"];
  const range = typeof ref === "string" ? decodeRange(ref) : null;
  const merges = workbookSheet["!merges"] || [];
  const rows = workbookSheet["!rows"] || [];
  const columns = workbookSheet["!cols"] || [];

  const discoveredRowCount = Math.max(
    range ? range.e.r + 1 : 0,
    rows.length,
    ...merges.map((merge) => merge.e.r + 1),
  );
  const discoveredColumnCount = Math.max(
    range ? range.e.c + 1 : 0,
    columns.length,
    ...merges.map((merge) => merge.e.c + 1),
  );

  return {
    rowCount: Math.max(DEFAULT_WORKSHEET_ROW_COUNT, discoveredRowCount),
    columnCount: Math.max(DEFAULT_WORKSHEET_COLUMN_COUNT, discoveredColumnCount),
  };
};

const convertGenericWorksheet = (
  workbookSheet: WorkSheet,
  sheetName: string,
  decodeCell: (address: string) => { r: number; c: number },
  decodeRange: (range: string) => SheetRange,
): UniverWorksheet => {
  const sheetId = crypto.randomUUID();
  const { rowCount, columnCount } = getWorksheetBounds(
    workbookSheet,
    decodeRange,
  );
  const nextSheet = buildEmptyWorksheet(sheetId, sheetName, rowCount, columnCount);

  Object.entries(workbookSheet).forEach(([address, rawCell]) => {
    if (address.startsWith("!")) {
      return;
    }

    const convertedCell = convertGenericCell(rawCell as CellObject);

    if (!convertedCell) {
      return;
    }

    const { r: rowIndex, c: columnIndex } = decodeCell(address);
    const currentRow = nextSheet.cellData[rowIndex] || {};

    currentRow[columnIndex] = convertedCell;
    nextSheet.cellData[rowIndex] = currentRow;
  });

  nextSheet.mergeData = convertMerges(workbookSheet["!merges"]);
  nextSheet.rowData = convertRows(workbookSheet["!rows"]);
  nextSheet.columnData = convertColumns(workbookSheet["!cols"]);

  return nextSheet;
};

const buildSpreadsheetData = (
  workbookName: string,
  sheets: UniverWorksheet[],
  styles: Record<string, UniverStyle> = {},
): SpreadsheetData => ({
  id: crypto.randomUUID(),
  name: workbookName,
  appVersion: UNIVER_APP_VERSION,
  locale: UNIVER_LOCALE,
  styles,
  sheetOrder: sheets.map((sheet) => sheet.id),
  sheets: Object.fromEntries(sheets.map((sheet) => [sheet.id, sheet])),
  resources: [],
});

const convertGenericWorkbook = (
  workbook: WorkBook,
  fileName: string,
  decodeCell: (address: string) => { r: number; c: number },
  decodeRange: (range: string) => SheetRange,
): { name: string; data: SpreadsheetData } => {
  const usedSheetNames = new Set<string>();
  const workbookName = normalizeWorkbookName(fileName);
  const sheets = workbook.SheetNames.map((sheetName, index) =>
    convertGenericWorksheet(
      workbook.Sheets[sheetName],
      normalizeSheetName(sheetName, index, usedSheetNames),
      decodeCell,
      decodeRange,
    ),
  );

  if (sheets.length === 0) {
    throw new Error("O arquivo não possui abas válidas para importar.");
  }

  return {
    name: workbookName,
    data: buildSpreadsheetData(workbookName, sheets),
  };
};

const clampColorChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

const applyTint = (hexColor: string, tint: number | undefined): string => {
  if (typeof tint !== "number" || tint === 0) {
    return hexColor;
  }

  const hex = hexColor.replace("#", "");
  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  const tintedChannels = channels.map((channel) =>
    tint < 0
      ? clampColorChannel(channel * (1 + tint))
      : clampColorChannel(channel * (1 - tint) + 255 * tint),
  );

  return `#${tintedChannels
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
};

const resolveExcelColor = (
  color: Partial<ExcelColor> | undefined,
): string | null => {
  const runtimeColor = color as
    | (Partial<ExcelColor> & { tint?: number; indexed?: number })
    | undefined;

  if (!color) {
    return null;
  }

  if (typeof color.argb === "string" && color.argb.length >= 6) {
    return `#${color.argb.slice(-6)}`;
  }

  if (typeof color.theme === "number") {
    const baseThemeColor = EXCEL_THEME_COLORS[color.theme];
    return baseThemeColor
      ? applyTint(baseThemeColor, runtimeColor?.tint)
      : null;
  }

  if (
    typeof runtimeColor?.indexed === "number" &&
    Object.prototype.hasOwnProperty.call(
      EXCEL_INDEXED_COLORS,
      runtimeColor.indexed,
    )
  ) {
    return EXCEL_INDEXED_COLORS[runtimeColor.indexed];
  }

  return null;
};

const mapBorderStyle = (style: string | undefined): number => {
  switch (style) {
    case "thin":
      return BORDER_STYLE_THIN;
    case "hair":
      return BORDER_STYLE_HAIR;
    case "dotted":
      return BORDER_STYLE_DOTTED;
    case "dashed":
      return BORDER_STYLE_DASHED;
    case "dashDot":
      return BORDER_STYLE_DASH_DOT;
    case "dashDotDot":
      return BORDER_STYLE_DASH_DOT_DOT;
    case "double":
      return BORDER_STYLE_DOUBLE;
    case "medium":
      return BORDER_STYLE_MEDIUM;
    case "mediumDashed":
      return BORDER_STYLE_MEDIUM_DASHED;
    case "mediumDashDot":
      return BORDER_STYLE_MEDIUM_DASH_DOT;
    case "mediumDashDotDot":
      return BORDER_STYLE_MEDIUM_DASH_DOT_DOT;
    case "slantDashDot":
      return BORDER_STYLE_SLANT_DASH_DOT;
    case "thick":
      return BORDER_STYLE_THICK;
    default:
      return BORDER_STYLE_NONE;
  }
};

const buildBorderEdge = (
  edge: Partial<ExcelBorderEdge> | undefined,
): UniverBorderStyle | undefined => {
  if (!edge?.style) {
    return undefined;
  }

  const style = mapBorderStyle(edge.style);

  if (style === BORDER_STYLE_NONE) {
    return undefined;
  }

  return {
    s: style,
    cl: {
      rgb: resolveExcelColor(edge.color) || DEFAULT_FONT_COLOR,
    },
  };
};

const buildBorderData = (border: Partial<ExcelBorders> | undefined) => {
  if (!border) {
    return undefined;
  }

  const nextBorder = {
    t: buildBorderEdge(border.top),
    r: buildBorderEdge(border.right),
    b: buildBorderEdge(border.bottom),
    l: buildBorderEdge(border.left),
  };

  return Object.values(nextBorder).some(Boolean) ? nextBorder : undefined;
};

const mapHorizontalAlignment = (value: string | undefined): number | undefined => {
  switch (value) {
    case "left":
      return HORIZONTAL_ALIGN_LEFT;
    case "center":
      return HORIZONTAL_ALIGN_CENTER;
    case "right":
      return HORIZONTAL_ALIGN_RIGHT;
    case "justify":
      return HORIZONTAL_ALIGN_JUSTIFIED;
    case "distributed":
      return HORIZONTAL_ALIGN_DISTRIBUTED;
    default:
      return undefined;
  }
};

const mapVerticalAlignment = (value: string | undefined): number | undefined => {
  switch (value) {
    case "top":
      return VERTICAL_ALIGN_TOP;
    case "middle":
      return VERTICAL_ALIGN_MIDDLE;
    case "bottom":
      return VERTICAL_ALIGN_BOTTOM;
    default:
      return undefined;
  }
};

const buildAlignmentData = (
  alignment: Partial<ExcelAlignment> | undefined,
): Pick<UniverStyle, "ht" | "vt" | "tb"> => {
  const nextAlignment: Pick<UniverStyle, "ht" | "vt" | "tb"> = {};
  const horizontal = mapHorizontalAlignment(alignment?.horizontal);
  const vertical = mapVerticalAlignment(alignment?.vertical);

  if (typeof horizontal === "number") {
    nextAlignment.ht = horizontal;
  }

  if (typeof vertical === "number") {
    nextAlignment.vt = vertical;
  }

  if (alignment?.wrapText) {
    nextAlignment.tb = WRAP_STRATEGY_WRAP;
  }

  return nextAlignment;
};

const buildFontData = (
  font: Partial<ExcelFont> | undefined,
): Pick<UniverStyle, "ff" | "fs" | "it" | "bl" | "ul" | "st" | "cl"> => {
  const nextFont: Pick<UniverStyle, "ff" | "fs" | "it" | "bl" | "ul" | "st" | "cl"> =
    {};

  if (font?.name && font.name !== DEFAULT_FONT_NAME) {
    nextFont.ff = font.name;
  }

  if (typeof font?.size === "number" && font.size !== DEFAULT_FONT_SIZE) {
    nextFont.fs = font.size;
  }

  if (font?.italic) {
    nextFont.it = BOOLEAN_TRUE;
  }

  if (font?.bold) {
    nextFont.bl = BOOLEAN_TRUE;
  }

  if (font?.underline) {
    nextFont.ul = {
      s: BOOLEAN_TRUE,
      t: TEXT_DECORATION_SINGLE,
    };
  }

  if (font?.strike) {
    nextFont.st = {
      s: BOOLEAN_TRUE,
      t: TEXT_DECORATION_SINGLE,
    };
  }

  const fontColor = resolveExcelColor(font?.color);

  if (fontColor && fontColor !== DEFAULT_FONT_COLOR) {
    nextFont.cl = { rgb: fontColor };
  }

  return nextFont;
};

const buildFillData = (fill: ExcelFill | undefined): Pick<UniverStyle, "bg"> => {
  if (!fill || fill.type !== "pattern" || fill.pattern !== "solid") {
    return {};
  }

  const backgroundColor = resolveExcelColor(fill.fgColor);

  return backgroundColor
    ? {
        bg: { rgb: backgroundColor },
      }
    : {};
};

const buildCellStyle = (
  cell: ExcelCell,
  includeFontDefaults: boolean,
): UniverStyle | null => {
  const nextStyle: UniverStyle = {};
  const fontData = buildFontData(cell.font);
  const fillData = buildFillData(cell.fill);
  const borderData = buildBorderData(cell.border);
  const alignmentData = buildAlignmentData(cell.alignment);

  Object.assign(nextStyle, fontData, fillData, alignmentData);

  if (borderData) {
    nextStyle.bd = borderData;
  }

  if (typeof cell.numFmt === "string" && cell.numFmt.trim().length > 0) {
    nextStyle.n = {
      pattern: cell.numFmt,
    };
  }

  if (!includeFontDefaults) {
    if (nextStyle.ff === DEFAULT_FONT_NAME) delete nextStyle.ff;
    if (nextStyle.fs === DEFAULT_FONT_SIZE) delete nextStyle.fs;
    if (nextStyle.cl?.rgb === DEFAULT_FONT_COLOR) delete nextStyle.cl;
  }

  return Object.keys(nextStyle).length > 0 ? nextStyle : null;
};

const getStyleId = (
  styleRegistry: StyleRegistry,
  style: UniverStyle | null,
): string | undefined => {
  if (!style) {
    return undefined;
  }

  const styleKey = JSON.stringify(style);
  const existingStyleId = styleRegistry.byKey.get(styleKey);

  if (existingStyleId) {
    return existingStyleId;
  }

  const styleId = `style-${styleRegistry.nextId}`;
  styleRegistry.nextId += 1;
  styleRegistry.byKey.set(styleKey, styleId);
  styleRegistry.styles[styleId] = style;
  return styleId;
};

const dateToExcelSerial = (date: Date, date1904: boolean): number => {
  const utcMillis = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
  const excelEpoch = date1904
    ? Date.UTC(1904, 0, 1)
    : Date.UTC(1899, 11, 30);

  return (utcMillis - excelEpoch) / 86400000;
};

const applyExcelValueToCell = (
  targetCell: UniverCell,
  value: ExcelCellValue,
  date1904: boolean,
  preferredText?: string,
): void => {
  if (value === null || typeof value === "undefined") {
    if (preferredText && preferredText.trim().length > 0) {
      targetCell.v = preferredText;
      targetCell.t = CELL_TYPE_STRING;
    }
    return;
  }

  if (typeof value === "string") {
    targetCell.v = value;
    targetCell.t = CELL_TYPE_STRING;
    return;
  }

  if (typeof value === "number") {
    targetCell.v = value;
    targetCell.t = CELL_TYPE_NUMBER;
    return;
  }

  if (typeof value === "boolean") {
    targetCell.v = value;
    targetCell.t = CELL_TYPE_BOOLEAN;
    return;
  }

  if (value instanceof Date) {
    targetCell.v = dateToExcelSerial(value, date1904);
    targetCell.t = CELL_TYPE_NUMBER;
    return;
  }

  if (typeof value === "object") {
    if ("formula" in value && typeof value.formula === "string") {
      targetCell.f = `=${value.formula}`;
      applyExcelValueToCell(
        targetCell,
        (value as { result?: ExcelCellValue }).result ?? null,
        date1904,
        preferredText,
      );
      return;
    }

    if ("richText" in value && Array.isArray(value.richText)) {
      targetCell.v = value.richText.map((segment) => segment.text).join("");
      targetCell.t = CELL_TYPE_STRING;
      return;
    }

    if ("text" in value && typeof value.text === "string") {
      targetCell.v = value.text;
      targetCell.t = CELL_TYPE_STRING;
      return;
    }

    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      targetCell.v =
        ("text" in value && typeof value.text === "string"
          ? value.text
          : value.hyperlink) || "";
      targetCell.t = CELL_TYPE_STRING;
      return;
    }

    if ("error" in value && typeof value.error === "string") {
      targetCell.v = value.error;
      targetCell.t = CELL_TYPE_STRING;
      return;
    }
  }

  if (preferredText && preferredText.trim().length > 0) {
    targetCell.v = preferredText;
    targetCell.t = CELL_TYPE_STRING;
  }
};

const convertExcelColumnWidth = (width: number | undefined): number | undefined =>
  typeof width === "number" && width > 0 ? Math.max(1, Math.round(width * 6)) : undefined;

const convertExcelWorksheet = (
  worksheet: ExcelWorksheet,
  sheetName: string,
  styleRegistry: StyleRegistry,
  date1904: boolean,
): UniverWorksheet => {
  const sheetId = crypto.randomUUID();
  const mergeRanges = (worksheet.model.merges || []).map(decodeRangeReference);
  const maxMergedRow = Math.max(0, ...mergeRanges.map((range) => range.e.r + 1));
  const maxMergedColumn = Math.max(
    0,
    ...mergeRanges.map((range) => range.e.c + 1),
  );
  const rowCount = Math.max(
    DEFAULT_WORKSHEET_ROW_COUNT,
    worksheet.rowCount,
    maxMergedRow,
  );
  const columnCount = Math.max(
    DEFAULT_WORKSHEET_COLUMN_COUNT,
    worksheet.columnCount,
    maxMergedColumn,
  );
  const nextSheet = buildEmptyWorksheet(sheetId, sheetName, rowCount, columnCount);
  const firstView = worksheet.views?.[0];

  nextSheet.hidden = worksheet.state === "visible" ? BOOLEAN_FALSE : BOOLEAN_TRUE;
  nextSheet.showGridlines =
    firstView?.showGridLines === false ? BOOLEAN_FALSE : BOOLEAN_TRUE;
  nextSheet.rightToLeft = firstView?.rightToLeft ? BOOLEAN_TRUE : BOOLEAN_FALSE;
  nextSheet.zoomRatio =
    typeof firstView?.zoomScale === "number" && firstView.zoomScale > 0
      ? firstView.zoomScale / 100
      : 1;

  if (firstView?.state === "frozen") {
    const xSplit = typeof firstView.xSplit === "number" ? firstView.xSplit : 0;
    const ySplit = typeof firstView.ySplit === "number" ? firstView.ySplit : 0;

    nextSheet.freeze = {
      xSplit,
      ySplit,
      startRow: ySplit > 0 ? ySplit : -1,
      startColumn: xSplit > 0 ? xSplit : -1,
    };
  }

  if (worksheet.properties.tabColor?.argb) {
    nextSheet.tabColor = `#${worksheet.properties.tabColor.argb.slice(-6)}`;
  }

  for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
    const column = worksheet.getColumn(columnIndex);
    const nextColumn: { w?: number; hd?: number } = {};
    const width = convertExcelColumnWidth(column.width);

    if (typeof width === "number") {
      nextColumn.w = width;
    }

    if (column.hidden) {
      nextColumn.hd = BOOLEAN_TRUE;
    }

    if (Object.keys(nextColumn).length > 0) {
      nextSheet.columnData[columnIndex - 1] = nextColumn;
    }
  }

  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    const nextRow: { h?: number; hd?: number } = {};

    if (typeof row.height === "number" && row.height > 0) {
      nextRow.h = Math.round(row.height * (96 / 72));
    }

    if (row.hidden) {
      nextRow.hd = BOOLEAN_TRUE;
    }

    if (Object.keys(nextRow).length > 0) {
      nextSheet.rowData[rowIndex - 1] = nextRow;
    }

    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const currentRow = nextSheet.cellData[rowIndex - 1] || {};
      const isMergedFollower =
        cell.isMerged && cell.master && cell.master.address !== cell.address;
      const styleId = getStyleId(
        styleRegistry,
        buildCellStyle(cell, !isMergedFollower),
      );
      const nextCell: UniverCell = {};

      if (styleId) {
        nextCell.s = styleId;
      }

      if (!isMergedFollower) {
        applyExcelValueToCell(
          nextCell,
          cell.value,
          date1904,
          typeof cell.text === "string" ? cell.text : undefined,
        );
      }

      if (
        typeof nextCell.v === "undefined" &&
        typeof nextCell.f === "undefined" &&
        typeof nextCell.s === "undefined"
      ) {
        return;
      }

      currentRow[columnNumber - 1] = nextCell;
      nextSheet.cellData[rowIndex - 1] = currentRow;
    });
  }

  nextSheet.mergeData = convertMerges(mergeRanges);
  return nextSheet;
};

const convertStyledExcelWorkbook = (
  workbook: ExcelWorkbook,
  fileName: string,
): { name: string; data: SpreadsheetData } => {
  const workbookName = normalizeWorkbookName(fileName);
  const usedSheetNames = new Set<string>();
  const styleRegistry = createStyleRegistry();
  const date1904 = Boolean(workbook.properties.date1904);
  const sheets = workbook.worksheets.map((worksheet, index) =>
    convertExcelWorksheet(
      worksheet,
      normalizeSheetName(worksheet.name, index, usedSheetNames),
      styleRegistry,
      date1904,
    ),
  );

  if (sheets.length === 0) {
    throw new Error("O arquivo não possui abas válidas para importar.");
  }

  return {
    name: workbookName,
    data: buildSpreadsheetData(workbookName, sheets, styleRegistry.styles),
  };
};

const importGenericSpreadsheet = async (
  file: File,
  fileExtension: string | undefined,
): Promise<{ name: string; data: SpreadsheetData }> => {
  const xlsx = await import("xlsx");
  const fileBuffer = await file.arrayBuffer();
  let workbook: WorkBook;

  try {
    workbook = xlsx.read(fileBuffer, {
      type: "array",
      raw: fileExtension ? TEXT_BASED_EXTENSIONS.has(fileExtension) : false,
      cellDates: true,
      cellFormula: true,
      cellNF: false,
      cellStyles: false,
    });
  } catch (error) {
    console.error("Error reading generic spreadsheet import file:", error);
    throw new Error(
      "Não foi possível ler o arquivo. Envie uma planilha compatível, como XLSX, XLS, XLSM, XLSB, CSV ou ODS.",
    );
  }

  return convertGenericWorkbook(
    workbook,
    file.name,
    xlsx.utils.decode_cell,
    xlsx.utils.decode_range,
  );
};

const importStyledExcelSpreadsheet = async (
  file: File,
): Promise<{ name: string; data: SpreadsheetData }> => {
  const ExcelJSModule = await import("exceljs");
  const ExcelJS = (ExcelJSModule.default ??
    ExcelJSModule) as typeof import("exceljs");
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch (error) {
    console.error("Error reading styled Excel import file:", error);
    throw new Error("Não foi possível ler o arquivo Excel.");
  }

  return convertStyledExcelWorkbook(workbook, file.name);
};

export const importExcelFileToSpreadsheetData = async (
  file: File,
): Promise<{ name: string; data: SpreadsheetData }> => {
  const fileExtension = file.name.split(".").pop()?.toLowerCase();

  if (
    fileExtension &&
    !SUPPORTED_SPREADSHEET_EXTENSION_SET.has(fileExtension)
  ) {
    throw new Error(
      `Formato não suportado. Use: ${SUPPORTED_SPREADSHEET_EXTENSIONS.join(", ")}.`,
    );
  }

  if (fileExtension && STYLED_EXCEL_EXTENSIONS.has(fileExtension)) {
    try {
      return await importStyledExcelSpreadsheet(file);
    } catch (error) {
      console.warn(
        "Falling back to generic spreadsheet import after styled import failure:",
        error,
      );
    }
  }

  return importGenericSpreadsheet(file, fileExtension);
};
