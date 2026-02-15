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
    // Create new sheet
    const addRes = await sheets.spreadsheets.batchUpdate({
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
    const newSheetId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;

    // Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${shippingDate}'!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['発送日', '店舗名', '商品名', '数量', '発注先', '処理者', '登録日時']],
      },
    });

    // Apply formatting
    const colWidths = [100, 120, 160, 80, 100, 80, 140]; // A-G
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          // Column widths
          ...colWidths.map((px, i) => ({
            updateDimensionProperties: {
              range: { sheetId: newSheetId, dimension: 'COLUMNS' as const, startIndex: i, endIndex: i + 1 },
              properties: { pixelSize: px },
              fields: 'pixelSize',
            },
          })),
          // Header row: background color (dark blue)
          {
            repeatCell: {
              range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.7 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // Header row height
          {
            updateDimensionProperties: {
              range: { sheetId: newSheetId, dimension: 'ROWS' as const, startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 32 },
              fields: 'pixelSize',
            },
          },
          // Freeze header row
          {
            updateSheetProperties: {
              properties: { sheetId: newSheetId, gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          // Border around header
          {
            updateBorders: {
              range: { sheetId: newSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 },
              bottom: { style: 'SOLID_MEDIUM', color: { red: 0.15, green: 0.3, blue: 0.55 } },
            },
          },
        ],
      },
    });
  }

  // Append data rows
  const values = rows.map((row) => [
    row.shippingDate,
    row.storeName,
    row.productName,
    row.quantity,
    row.supplier,
    row.processor,
    row.registeredAt,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${shippingDate}'!A:G`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });

  return rows.length;
}

export async function getOrderRows(shippingDate: string): Promise<OrderRow[]> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();

  const sheetId = await getSheetId(sheets, spreadsheetId, shippingDate);
  if (sheetId === null) return [];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${shippingDate}'!A:G`,
  });
  const rows = res.data.values;
  if (!rows || rows.length <= 1) return [];

  return rows.slice(1).map((row) => ({
    shippingDate: row[0] || '',
    storeName: row[1] || '',
    productName: row[2] || '',
    quantity: row[3] || '',
    supplier: row[4] || '',
    processor: row[5] || '',
    registeredAt: row[6] || '',
  }));
}

// ==================== スプレッドシートURL ====================

export async function getSheetUrl(sheetName: string): Promise<string> {
  const sheets = getSheets();
  const spreadsheetId = getSpreadsheetId();
  const sheetId = await getSheetId(sheets, spreadsheetId, sheetName);
  const gidParam = sheetId !== null ? `#gid=${sheetId}` : '';
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit${gidParam}`;
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
