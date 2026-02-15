import { NextRequest, NextResponse } from 'next/server';
import {
  getProductMasters,
  addProductMaster,
  updateProductMaster,
  deleteProductMaster,
} from '@/lib/sheetsClient';

export async function GET() {
  try {
    const products = await getProductMasters();
    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch product masters:', error);
    return NextResponse.json({ error: '商品マスタの取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productName, alias, supplier } = body;
    if (!productName) {
      return NextResponse.json({ error: '正式商品名は必須です' }, { status: 400 });
    }
    await addProductMaster({ productName, alias: alias || '', supplier: supplier || '' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to add product master:', error);
    return NextResponse.json({ error: '商品マスタの追加に失敗しました' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowIndex, productName, alias, supplier } = body;
    if (rowIndex === undefined || !productName) {
      return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
    }
    await updateProductMaster(rowIndex, { productName, alias: alias || '', supplier: supplier || '' });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update product master:', error);
    return NextResponse.json({ error: '商品マスタの更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { rowIndex } = body;
    if (rowIndex === undefined) {
      return NextResponse.json({ error: 'rowIndexは必須です' }, { status: 400 });
    }
    await deleteProductMaster(rowIndex);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete product master:', error);
    return NextResponse.json({ error: '商品マスタの削除に失敗しました' }, { status: 500 });
  }
}
