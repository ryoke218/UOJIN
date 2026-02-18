'use client';

import { useEffect, useState } from 'react';
import { OrderRow } from '@/types/order';

type ViewMode = 'supplier' | 'store' | 'product';

interface GroupData {
  label: string;
  rows: OrderRow[];
}

function groupBy(rows: OrderRow[], mode: ViewMode): GroupData[] {
  const map = new Map<string, OrderRow[]>();
  for (const row of rows) {
    let key: string;
    if (mode === 'supplier') key = row.supplier || '（発注先未設定）';
    else if (mode === 'store') key = row.storeName || '（店舗未設定）';
    else key = row.productName || '（商品未設定）';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  }
  return Array.from(map.entries()).map(([label, rows]) => ({ label, rows }));
}

const VIEW_LABELS: Record<ViewMode, string> = {
  supplier: '発注先別',
  store: '店舗別',
  product: '商品別',
};

// 各ビューモードでテーブルに表示するカラム
function getColumns(mode: ViewMode): { label: string; key: keyof OrderRow }[] {
  if (mode === 'supplier') return [
    { label: '店舗', key: 'storeName' },
    { label: '商品名', key: 'productName' },
    { label: '数量', key: 'quantity' },
  ];
  if (mode === 'store') return [
    { label: '商品名', key: 'productName' },
    { label: '数量', key: 'quantity' },
    { label: '発注先', key: 'supplier' },
  ];
  // product
  return [
    { label: '店舗', key: 'storeName' },
    { label: '数量', key: 'quantity' },
    { label: '発注先', key: 'supplier' },
  ];
}

export default function PrintPage() {
  const [shippingDate, setShippingDate] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('supplier');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedGroup, setCopiedGroup] = useState<number | null>(null);

  useEffect(() => {
    const dateRaw = sessionStorage.getItem('uojin-date');
    const date = dateRaw ? JSON.parse(dateRaw) : '';
    if (!date) {
      setIsLoading(false);
      setError('発送日が設定されていません');
      return;
    }
    setShippingDate(date);

    fetch(`/api/orders?date=${encodeURIComponent(date)}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRows(data);
        } else {
          setError(data.error || 'データの取得に失敗しました');
        }
      })
      .catch(() => setError('データの取得に失敗しました'))
      .finally(() => setIsLoading(false));
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  };

  const now = new Date();
  const printedAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const handleCopyOrder = async (group: GroupData, groupIndex: number) => {
    const lines = group.rows.map((row, i) =>
      `${i + 1} ${row.productName} ${row.quantity}`
    );
    const text = lines.join('\n');
    await navigator.clipboard.writeText(text);
    setCopiedGroup(groupIndex);
    setTimeout(() => setCopiedGroup(null), 2000);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">読み込み中...</div>;
  }

  if (error || rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        {error || '出力するデータがありません'}
      </div>
    );
  }

  const groups = groupBy(rows, viewMode);
  const columns = getColumns(viewMode);

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 10mm 8mm; }
        }
      `}</style>

      {/* 操作バー */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-2 rounded-lg font-medium text-sm shadow-lg transition-colors ${
              viewMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            {VIEW_LABELS[mode]}
          </button>
        ))}
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium shadow-lg hover:bg-green-700 transition-colors"
        >
          印刷
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium shadow-lg hover:bg-gray-300 transition-colors"
        >
          閉じる
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-4 mt-16 print:mt-0">
        {/* ヘッダー */}
        <div className="border-b-4 border-blue-600 pb-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            出荷指示書
            <span className="text-base font-normal text-gray-500 ml-3">（{VIEW_LABELS[viewMode]}）</span>
          </h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <div>
              <span className="font-medium text-gray-800">出荷日：</span>
              <span className="text-lg font-bold text-blue-700">{formatDate(shippingDate)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-800">出力日時：</span>
              <span>{printedAt}</span>
            </div>
            <div>
              <span className="font-medium text-gray-800">合計：</span>
              <span>{rows.length}件 / {groups.length}{viewMode === 'supplier' ? '発注先' : viewMode === 'store' ? '店舗' : '商品'}</span>
            </div>
          </div>
        </div>

        {/* グループごとのブロック */}
        {groups.map((group, gi) => (
          <div key={gi} className="mb-5 break-inside-avoid">
            <div className="bg-blue-600 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
              <span className="font-bold text-base">{group.label}</span>
              <div className="flex items-center gap-2">
                {viewMode === 'supplier' && (
                  <button
                    onClick={() => handleCopyOrder(group, gi)}
                    className="no-print px-2 py-0.5 text-xs rounded bg-white/20 hover:bg-white/30 transition-colors"
                  >
                    {copiedGroup === gi ? 'コピー済' : 'コピー'}
                  </button>
                )}
                <span className="text-blue-200 text-sm">{group.rows.length}件</span>
              </div>
            </div>

            <table className="w-full text-sm border-collapse border border-gray-300 border-t-0">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left px-3 py-1.5 border-b border-r border-gray-300 w-8 text-gray-500">#</th>
                  {columns.map((col) => (
                    <th key={col.key} className="text-left px-3 py-1.5 border-b border-r border-gray-300 last:border-r-0">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-1.5 border-b border-r border-gray-300 text-gray-400 text-center">{row.seqNo ?? ri + 1}</td>
                    {columns.map((col) => (
                      <td key={col.key} className="px-3 py-1.5 border-b border-r border-gray-300 last:border-r-0">
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* フッター */}
        <div className="mt-6 pt-3 border-t-2 border-gray-300 text-xs text-gray-400 text-center">
          UOJIN 出荷指示書 - {formatDate(shippingDate)}
        </div>
      </div>
    </>
  );
}
