import { NextRequest, NextResponse } from 'next/server';
import { appendOrderRows } from '@/lib/sheetsClient';
import { OrderRow } from '@/types/order';

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
      productName: order.productName,
      quantity: order.quantity || '',
      alias: order.alias,
      supplier: order.supplier || '',
      processor: processor || '',
      registeredAt,
    }));

    const count = await appendOrderRows(shippingDate, rows);
    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error('Failed to write orders:', error);
    return NextResponse.json({ error: '受注データの書き込みに失敗しました' }, { status: 500 });
  }
}
