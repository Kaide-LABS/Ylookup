export interface CellScore {
  row_index: number;
  col_index: number;
  cell_text: string;
  confidence: number;
  flag: "none" | "low_confidence" | "anomaly" | "format_issue";
  reason: string;
}

export interface ReviewAction {
  id: string;
  type: "accept" | "reject" | "edit";
  cell: CellScore;
  new_value?: string;
  reviewer_note?: string;
  timestamp: string;
  table_index: number;
  page: number;
}

// In-memory store for demo purposes
let auditTrail: ReviewAction[] = [];

export const addAction = (action: ReviewAction): void => {
  auditTrail.push(action);
};

export const getActions = (): ReviewAction[] => {
  return [...auditTrail];
};

export const getActionsForCell = (row: number, col: number, tableIndex: number): ReviewAction[] => {
  return auditTrail.filter(
    (a) => a.cell.row_index === row && a.cell.col_index === col && a.table_index === tableIndex
  );
};

export const clearAuditTrail = (): void => {
  auditTrail = [];
};

export const exportAuditTrail = (): string => {
  return JSON.stringify(auditTrail, null, 2);
};
