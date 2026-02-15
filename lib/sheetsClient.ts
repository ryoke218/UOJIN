import { google, sheets_v4 } from 'googleapis';
import { StoreMaster, ProductMaster, OrderRow } from '@/types/order';

const STORE_SHEET_NAME = '店舗マスタ';
const PRODUCT_SHEET_NAME = '商品マスタ';

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) {
    throw new Error('Google service account credentials not configured');
  }
  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getSheets(): sheets_v4.Sheets {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getSpreadsheetId(): string {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error('SPREADSHEET_ID not configured');
  return id;
}

// ==================== 店舗マスタ ====================

export async function getStoreMasters(): Promise<StoreMaster[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${STORE_SHEET_NAME}!A:B`,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) return [];
  // Skip header row
  return rows.slice(1).map((row) => ({
    inputName: row[0] || '',
    formalName: row[1] || '',
  }));
}

export async function addStoreMaster(entry: StoreMaster): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${STORE_SHEET_NAME}!A:B`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[entry.inputName, entry.formalName]],
    },
  });
}

export async function updateStoreMaster(rowIndex: number, entry: StoreMaster): Promise<void> {
  const sheets = getSheets();
  const sheetRow = rowIndex + 2; // +1 for 0-index, +1 for header
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${STORE_SHEET_NAME}!A${sheetRow}:B${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[entry.inputName, entry.formalName]],
    },
  });
}

export async function deleteStoreMaster(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  // Get sheetId for 店舗マスタ
  const sheetId = await getSheetId(sheets, spreadsheetId, STORE_SHEET_NAME);
  if (sheetId === null) throw new Error(`Sheet "${STORE_SHEET_NAME}" not found`);

  const sheetRow = rowIndex + 1; // +1 for header (0-indexed in deleteDimension)
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow,
              endIndex: sheetRow + 1,
            },
          },
        },
      ],
    },
  });
}

// ==================== 商品マスタ ====================

export async function getProductMasters(): Promise<ProductMaster[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getSpreadsheetId(),
    range: `${PRODUCT_SHEET_NAME}!A:C`,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) return [];
  return rows.slice(1).map((row) => ({
    productName: row[0] || '',
    alias: row[1] || '',
    supplier: row[2] || '',
  }));
}

export async function addProductMaster(entry: ProductMaster): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getSpreadsheetId(),
    range: `${PRODUCT_SHEET_NAME}!A:C`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[entry.productName, entry.alias, entry.supplier]],
    },
  });
}

export async function updateProductMaster(rowIndex: number, entry: ProductMaster): Promise<void> {
  const sheets = getSheets();
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: getSpreadsheetId(),
    range: `${PRODUCT_SHEET_NAME}!A${sheetRow}:C${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[entry.productName, entry.alias, entry.supplier]],
    },
  });
}

export async function deleteProductMaster(rowIndex: number): Promise<void> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const sheetId = await getSheetId(sheets, spreadsheetId, PRODUCT_SHEET_NAME);
  if (sheetId === null) throw new Error(`Sheet "${PRODUCT_SHEET_NAME}" not found`);

  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: sheetRow,
              endIndex: sheetRow + 1,
            },
          },
        },
      ],
    },
  });
}

// ==================== 受注データ ====================

export async function appendOrderRows(shippingDate: string, rows: OrderRow[]): Promise<number> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  // Check if sheet for this date exists
  const sheetId = await getSheetId(sheets, spreadsheetId, shippingDate);

  if (sheetId === null) {
    // Create new sheet with header
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: shippingDate },
            },
          },
        ],
      },
    });
    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${shippingDate}'!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['発送日', '店舗名', '商品名', '数量', '付別名', '発注先', '処理者', '登録日時']],
      },
    });
  }

  // Append data rows
  const values = rows.map((row) => [
    row.shippingDate,
    row.storeName,
    row.productName,
    row.quantity,
    row.alias,
    row.supplier,
    row.processor,
    row.registeredAt,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${shippingDate}'!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  return rows.length;
}

// ==================== ヘルパー ====================

async function getSheetId(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<number | null> {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });
  const sheet = res.data.sheets?.find((s) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}
