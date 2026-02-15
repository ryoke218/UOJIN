import { NextRequest, NextResponse } from 'next/server';
import { getSheetUrl } from '@/lib/sheetsClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: '日付が指定されていません' }, { status: 400 });
    }
    const url = await getSheetUrl(date);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('Failed to get sheet URL:', error);
    return NextResponse.json({ error: 'スプレッドシートURLの取得に失敗しました' }, { status: 500 });
  }
}
