import { NextRequest, NextResponse } from 'next/server';
import { appendOrderRows, getOrderRows } from '@/lib/sheetsClient';
import { OrderRow } from '@/types/order';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shippingDate = searchParams.get('date');
    if (!shippingDate) {
      return NextResponse.json({ error: '日付が指定されていません' }, { status: 400 });
    }
    const rows = await getOrderRows(shippingDate);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to read orders:', error);
    return NextResponse.json({ error: '受注データの読み込みに失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shippingDate, orders, processor } = body as {
      shippingDate: string;
      orders: { storeName: string; productName: string; quantity: string; alias: string; supplier: string }[];
      processor: string;
    };

    if (!shippingDate || !orders || orders.length === 0) {
      return NextResponse.json({ error: '発送日と受注データは必須です' }, { status: 400 });
    }

    const now = new Date();
    const registeredAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rows: OrderRow[] = orders.map((order) => ({
      shippingDate,
      storeName: order.storeName,
      productName: order.alias || order.productName,
      quantity: order.quantity || '',
      supplier: order.supplier || '',
      processor: processor || '',
      registeredAt,
    }));

    const count = await appendOrderRows(shippingDate, rows);
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetUrl = spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
      : null;
    return NextResponse.json({ success: true, count, sheetUrl });
  } catch (error) {
    console.error('Failed to write orders:', error);
    return NextResponse.json({ error: '受注データの書き込みに失敗しました' }, { status: 500 });
  }
}
