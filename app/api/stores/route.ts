import { NextRequest, NextResponse } from 'next/server';
import {
  getStoreMasters,
  addStoreMaster,
  updateStoreMaster,
  deleteStoreMaster,
} from '@/lib/sheetsClient';

export async function GET() {
  try {
    const stores = await getStoreMasters();
    return NextResponse.json(stores);
  } catch (error) {
    console.error('Failed to fetch store masters:', error);
    return NextResponse.json({ error: '店舗マスタの取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inputName, formalName } = body;
    if (!inputName || !formalName) {
      return NextResponse.json({ error: '入力名と正式店舗名は必須です' }, { status: 400 });
    }
    await addStoreMaster({ inputName, formalName });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to add store master:', error);
    return NextResponse.json({ error: '店舗マスタの追加に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowIndex, inputName, formalName } = body;
    if (rowIndex === undefined || !inputName || !formalName) {
      return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
    }
    await updateStoreMaster(rowIndex, { inputName, formalName });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update store master:', error);
    return NextResponse.json({ error: '店舗マスタの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowIndex } = body;
    if (rowIndex === undefined) {
      return NextResponse.json({ error: 'rowIndexは必須です' }, { status: 400 });
    }
    await deleteStoreMaster(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete store master:', error);
    return NextResponse.json({ error: '店舗マスタの削除に失敗しました' }, { status: 500 });
  }
}
