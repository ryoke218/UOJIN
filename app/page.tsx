'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { StoreMaster, ProductMaster, ParsedOrderLine, ParseResult } from '@/types/order';
import { parseOrderText } from '@/lib/orderParser';
import { usePersistedState } from '@/lib/usePersistedState';

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function OrderInputPage() {
  const [shippingDate, setShippingDate, clearShippingDate] = usePersistedState('uojin-date', getTomorrowDate());
  const [processor, setProcessor] = usePersistedState('uojin-processor', '');
  const [text, setText, clearText] = usePersistedState('uojin-text', '');
  const [stores, setStores] = useState<StoreMaster[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [parseResult, setParseResult, clearParseResult] = usePersistedState<ParseResult | null>('uojin-result', null);
  const [editableLines, setEditableLines, clearEditableLines] = usePersistedState<ParsedOrderLine[]>('uojin-lines', []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テキストエリア自動リサイズ
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(el.scrollHeight, 160) + 'px';
  }, [text]);

  // マスタデータ読み込み
  useEffect(() => {
    async function loadMasters() {
      try {
        const [storeRes, productRes] = await Promise.all([
          fetch('/api/stores'),
          fetch('/api/products'),
        ]);
        const storeData = await storeRes.json();
        const productData = await productRes.json();
        if (Array.isArray(storeData)) setStores(storeData);
        if (Array.isArray(productData)) setProducts(productData);
      } catch (error) {
        console.error('Failed to load masters:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadMasters();
  }, []);

  // 解析実行（結果を蓄積）
  const handleParse = useCallback(() => {
    if (!text.trim()) return;
    const result = parseOrderText(text, stores, products);
    // スキップ行・日付アラートも蓄積
    setParseResult((prev) => {
      if (!prev) return result;
      return {
        lines: [...prev.lines, ...result.lines],
        dateAlert: result.dateAlert || prev.dateAlert,
        skippedLines: [...prev.skippedLines, ...result.skippedLines],
      };
    });
    setEditableLines((prev) => [...prev, ...result.lines]);
    setText('');
    setSubmitMessage('');
  }, [text, stores, products, setParseResult, setEditableLines, setText]);

  // エラー行の店舗名修正
  const handleStoreChange = useCallback((index: number, newStoreName: string) => {
    setEditableLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], storeName: newStoreName };
      if (newStoreName && (line.status === 'store-error' || line.status === 'both-error')) {
        line.status = line.status === 'both-error' ? 'product-error' : 'ok';
      }
      updated[index] = line;
      return updated;
    });
  }, [setEditableLines]);

  // エラー行の商品名修正
  const handleProductChange = useCallback((index: number, newProductName: string, newAlias: string, newSupplier: string) => {
    setEditableLines((prev) => {
      const updated = [...prev];
      const line = { ...updated[index], productName: newProductName, alias: newAlias, supplier: newSupplier };
      if (newProductName && (line.status === 'product-error' || line.status === 'both-error')) {
        line.status = line.status === 'both-error' ? 'store-error' : 'ok';
      }
      updated[index] = line;
      return updated;
    });
  }, [setEditableLines]);

  // 数量修正
  const handleQuantityChange = useCallback((index: number, value: string) => {
    setEditableLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: value };
      return updated;
    });
  }, [setEditableLines]);

  // 発注先修正
  const handleSupplierChange = useCallback((index: number, value: string) => {
    setEditableLines((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], supplier: value };
      return updated;
    });
  }, [setEditableLines]);

  // 行削除
  const handleDeleteLine = useCallback((index: number) => {
    setEditableLines((prev) => prev.filter((_, i) => i !== index));
  }, [setEditableLines]);

  // 全クリア
  const handleClear = useCallback(() => {
    clearText();
    clearParseResult();
    clearEditableLines();
    clearShippingDate();
    setSubmitMessage('');
  }, [clearText, clearParseResult, clearEditableLines, clearShippingDate]);

  // 送信
  const handleSubmit = async () => {
    const hasErrors = editableLines.some((l) => l.status !== 'ok');
    if (hasErrors) {
      if (!confirm('エラー行が残っています。エラーのまま送信しますか？')) {
        return;
      }
    }

    if (editableLines.length === 0) {
      setSubmitMessage('送信するデータがありません');
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingDate,
          processor,
          orders: editableLines.map((l) => ({
            storeName: l.storeName,
            productName: l.productName,
            quantity: l.quantity,
            alias: l.alias,
            supplier: l.supplier,
          })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSubmitMessage(`${data.count}件のデータをスプレッドシートに登録しました`);
        clearText();
        clearParseResult();
        clearEditableLines();
      } else {
        setSubmitMessage(`エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('Submit failed:', error);
      setSubmitMessage('送信に失敗しました。通信環境を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  // スプレッドシートを開く
  const handleOpenSheet = async () => {
    try {
      const res = await fetch(`/api/sheet-url?date=${encodeURIComponent(shippingDate)}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Failed to get sheet URL:', error);
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 発送日 + スプレッドシートボタン */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">発送日</label>
        <div className="flex gap-2">
          <input
            type="date"
            value={shippingDate}
            onChange={(e) => setShippingDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={handleOpenSheet}
            className="px-3 py-2 bg-teal-600 text-white rounded-lg font-medium text-sm min-h-[44px] hover:bg-teal-700 transition-colors whitespace-nowrap"
          >
            シートを開く
          </button>
          <button
            onClick={() => window.open('/print', '_blank')}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium text-sm min-h-[44px] hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            集計
          </button>
        </div>
      </div>

      {/* 処理者名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">処理者名（任意）</label>
        <input
          type="text"
          value={processor}
          onChange={(e) => setProcessor(e.target.value)}
          placeholder="例: 山田"
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>

      {/* テキストエリア */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">LINEメッセージ</label>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="LINEの受注メッセージをここに貼り付けてください"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-y min-h-[160px]"
        />
      </div>

      {/* 解析・クリアボタン */}
      <div className="flex gap-2">
        <button
          onClick={handleParse}
          disabled={!text.trim()}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium min-h-[44px] disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          解析
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium min-h-[44px] hover:bg-gray-300 transition-colors"
        >
          クリア
        </button>
      </div>

      {/* 解析結果 */}
      {(parseResult || editableLines.length > 0) && (
        <div className="space-y-3">
          {/* 日付アラート */}
          {parseResult?.dateAlert && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-sm text-yellow-800">
              メッセージ内に日付の記述があります: 「{parseResult.dateAlert}」
            </div>
          )}

          {/* スキップした行 */}
          {parseResult?.skippedLines && parseResult.skippedLines.length > 0 && (
            <div className="bg-orange-50 border-2 border-orange-400 rounded-lg px-3 py-3">
              <div className="font-bold text-orange-800 text-sm mb-1">
                スキップされた行（{parseResult.skippedLines.length}件）
              </div>
              <ul className="space-y-1">
                {parseResult.skippedLines.map((line, i) => (
                  <li key={i} className="text-sm text-orange-900 bg-orange-100 rounded px-2 py-1">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 結果テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-center px-1 py-2 border-b w-8 text-gray-500">#</th>
                  <th className="text-left px-2 py-2 border-b">店舗</th>
                  <th className="text-left px-2 py-2 border-b">商品</th>
                  <th className="text-left px-2 py-2 border-b">数量</th>
                  <th className="text-left px-2 py-2 border-b">発注先</th>
                  <th className="text-center px-1 py-2 border-b w-8"></th>
                </tr>
              </thead>
              <tbody>
                {editableLines.map((line, i) => {
                  const isError = line.status !== 'ok';
                  const isStoreError = line.status === 'store-error' || line.status === 'both-error';
                  const isProductError = line.status === 'product-error' || line.status === 'both-error';

                  // 商品マスタ登録済み = ok or store-error（商品は見つかった）
                  const isProductRegistered = line.status === 'ok' || line.status === 'store-error';

                  return (
                    <tr
                      key={i}
                      className={
                        isError
                          ? 'bg-red-50'
                          : isProductRegistered
                            ? 'bg-blue-50'
                            : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                      }
                    >
                      {/* # */}
                      <td className="px-1 py-2 border-b text-center text-gray-400 text-sm">{i + 1}</td>
                      {/* 店舗名 */}
                      <td className="px-2 py-2 border-b">
                        {isStoreError ? (
                          <select
                            value={line.storeName}
                            onChange={(e) => handleStoreChange(i, e.target.value)}
                            className="w-full border border-red-300 rounded px-1 py-1 bg-red-50 text-sm"
                          >
                            <option value="">-- 選択 --</option>
                            {[...new Set(stores.map((s) => s.formalName))].map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={line.storeName}
                            onChange={(e) => handleStoreChange(i, e.target.value)}
                            className="w-full border border-gray-300 rounded px-1 py-1 text-sm"
                          />
                        )}
                      </td>

                      {/* 商品名 */}
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={line.productName}
                          onChange={(e) => handleProductChange(i, e.target.value, line.alias, line.supplier)}
                          className={`w-full border rounded px-1 py-1 text-sm ${
                            isProductError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                          }`}
                        />
                      </td>

                      {/* 数量 */}
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={line.quantity}
                          onChange={(e) => handleQuantityChange(i, e.target.value)}
                          className="w-full border border-gray-300 rounded px-1 py-1 text-sm"
                        />
                      </td>

                      {/* 発注先 */}
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={line.supplier}
                          onChange={(e) => handleSupplierChange(i, e.target.value)}
                          className="w-full border border-gray-300 rounded px-1 py-1 text-sm"
                        />
                      </td>

                      {/* 削除 */}
                      <td className="px-1 py-2 border-b text-center">
                        <button
                          onClick={() => handleDeleteLine(i)}
                          className="text-red-400 hover:text-red-600 text-lg leading-none"
                          title="削除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || editableLines.length === 0}
              className="flex-1 py-3 text-white rounded-lg font-medium min-h-[44px] transition-colors bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '送信中...' : '送信'}
            </button>
          </div>
        </div>
      )}

      {/* 完了/エラーメッセージ */}
      {submitMessage && (
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            submitMessage.includes('エラー') || submitMessage.includes('失敗')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}
        >
          {submitMessage}
        </div>
      )}
    </div>
  );
}
