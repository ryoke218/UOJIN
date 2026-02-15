'use client';

import { useEffect, useState } from 'react';
import { ParsedOrderLine } from '@/types/order';

interface StoreGroup {
  storeName: string;
  lines: ParsedOrderLine[];
}

export default function PrintPage() {
  const [shippingDate, setShippingDate] = useState('');
  const [processor, setProcessor] = useState('');
  const [groups, setGroups] = useState<StoreGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const date = sessionStorage.getItem('uojin-date');
    const proc = sessionStorage.getItem('uojin-processor');
    const linesRaw = sessionStorage.getItem('uojin-lines');

    if (date) setShippingDate(JSON.parse(date));
    if (proc) setProcessor(JSON.parse(proc));

    if (linesRaw) {
      const lines: ParsedOrderLine[] = JSON.parse(linesRaw);
      const okLines = lines.filter((l) => l.status === 'ok');
      setTotalCount(okLines.length);

      // 店舗ごとにグループ化（出現順を維持）
      const storeMap = new Map<string, ParsedOrderLine[]>();
      for (const line of okLines) {
        const name = line.storeName || '（店舗未設定）';
        if (!storeMap.has(name)) storeMap.set(name, []);
        storeMap.get(name)!.push(line);
      }
      setGroups(Array.from(storeMap.entries()).map(([storeName, lines]) => ({ storeName, lines })));
    }
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${days[d.getDay()]}）`;
  };

  const now = new Date();
  const printedAt = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        出力するデータがありません
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 10mm 8mm; }
        }
      `}</style>

      {/* 印刷ボタン */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-lg hover:bg-blue-700 transition-colors"
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

      <div className="max-w-3xl mx-auto p-4">
        {/* ヘッダー */}
        <div className="border-b-4 border-blue-600 pb-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">出荷指示書</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-600">
            <div>
              <span className="font-medium text-gray-800">出荷日：</span>
              <span className="text-lg font-bold text-blue-700">{formatDate(shippingDate)}</span>
            </div>
            {processor && (
              <div>
                <span className="font-medium text-gray-800">処理者：</span>
                <span>{processor}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-800">出力日時：</span>
              <span>{printedAt}</span>
            </div>
            <div>
              <span className="font-medium text-gray-800">合計：</span>
              <span>{totalCount}件 / {groups.length}店舗</span>
            </div>
          </div>
        </div>

        {/* 店舗ごとのブロック */}
        {groups.map((group, gi) => (
          <div key={gi} className="mb-5 break-inside-avoid">
            {/* 店舗名ヘッダー */}
            <div className="bg-blue-600 text-white px-3 py-2 rounded-t-lg flex items-center justify-between">
              <span className="font-bold text-base">{group.storeName}</span>
              <span className="text-blue-200 text-sm">{group.lines.length}件</span>
            </div>

            {/* 商品テーブル */}
            <table className="w-full text-sm border-collapse border border-gray-300 border-t-0">
              <thead>
                <tr className="bg-blue-50">
                  <th className="text-left px-3 py-1.5 border-b border-r border-gray-300 w-8 text-gray-500">#</th>
                  <th className="text-left px-3 py-1.5 border-b border-r border-gray-300">商品名</th>
                  <th className="text-left px-3 py-1.5 border-b border-r border-gray-300">数量</th>
                  <th className="text-left px-3 py-1.5 border-b border-gray-300">発注先</th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map((line, li) => (
                  <tr
                    key={li}
                    className={li % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="px-3 py-1.5 border-b border-r border-gray-300 text-gray-400 text-center">{li + 1}</td>
                    <td className="px-3 py-1.5 border-b border-r border-gray-300 font-medium">{line.productName}</td>
                    <td className="px-3 py-1.5 border-b border-r border-gray-300">
                      {line.quantity}
                    </td>
                    <td className="px-3 py-1.5 border-b border-gray-300 text-gray-600">
                      {line.supplier}
                    </td>
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
