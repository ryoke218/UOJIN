'use client';

import { useState, useEffect, useCallback } from 'react';
import { ProductMaster } from '@/types/order';

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newProductName, setNewProductName] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState('');
  const [editAlias, setEditAlias] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [message, setMessage] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/products');
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (error) {
      console.error('Failed to load products:', error);
      setMessage('商品マスタの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleAdd = async () => {
    if (!newProductName.trim()) return;
    setMessage('');
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: newProductName.trim(),
          alias: newAlias.trim(),
          supplier: newSupplier.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewProductName('');
        setNewAlias('');
        setNewSupplier('');
        await loadProducts();
        setMessage('追加しました');
      } else {
        setMessage(data.error || '追加に失敗しました');
      }
    } catch {
      setMessage('追加に失敗しました');
    }
  };

  const handleEdit = (index: number) => {
    setEditIndex(index);
    setEditProductName(products[index].productName);
    setEditAlias(products[index].alias);
    setEditSupplier(products[index].supplier);
  };

  const handleSaveEdit = async () => {
    if (editIndex === null || !editProductName.trim()) return;
    setMessage('');
    try {
      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: editIndex,
          productName: editProductName.trim(),
          alias: editAlias.trim(),
          supplier: editSupplier.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditIndex(null);
        await loadProducts();
        setMessage('更新しました');
      } else {
        setMessage(data.error || '更新に失敗しました');
      }
    } catch {
      setMessage('更新に失敗しました');
    }
  };

  const handleCancelEdit = () => {
    setEditIndex(null);
  };

  const handleDelete = async (index: number) => {
    if (!confirm(`「${products[index].productName}」を削除しますか？`)) return;
    setMessage('');
    try {
      const res = await fetch('/api/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: index }),
      });
      const data = await res.json();
      if (data.success) {
        await loadProducts();
        setMessage('削除しました');
      } else {
        setMessage(data.error || '削除に失敗しました');
      }
    } catch {
      setMessage('削除に失敗しました');
    }
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">読み込み中...</div>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">商品マスタ</h1>

      {/* 追加フォーム */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            value={newProductName}
            onChange={(e) => setNewProductName(e.target.value)}
            placeholder="正式商品名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            placeholder="変換名（任意）"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            placeholder="発注先（任意）"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newProductName.trim()}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium min-h-[44px] disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          追加
        </button>
      </div>

      {/* メッセージ */}
      {message && (
        <div className={`text-sm px-3 py-2 rounded-lg ${
          message.includes('失敗') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {/* 一覧 */}
      {products.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">商品マスタが登録されていません</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border-b font-medium">正式商品名</th>
                <th className="text-left px-3 py-2 border-b font-medium">変換名</th>
                <th className="text-left px-3 py-2 border-b font-medium">発注先</th>
                <th className="text-center px-2 py-2 border-b font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {editIndex === i ? (
                    <>
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={editProductName}
                          onChange={(e) => setEditProductName(e.target.value)}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={editAlias}
                          onChange={(e) => setEditAlias(e.target.value)}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={editSupplier}
                          onChange={(e) => setEditSupplier(e.target.value)}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 border-b text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={handleSaveEdit}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                          >
                            保存
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="text-gray-500 hover:text-gray-700 text-xs px-1"
                          >
                            取消
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 border-b">{product.productName}</td>
                      <td className="px-3 py-2 border-b text-gray-500">{product.alias || '-'}</td>
                      <td className="px-3 py-2 border-b text-gray-500">{product.supplier || '-'}</td>
                      <td className="px-2 py-2 border-b text-center">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => handleEdit(i)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium px-1"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDelete(i)}
                            className="text-red-500 hover:text-red-700 text-xs px-1"
                          >
                            削除
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 text-center">
        {products.length}件登録済み
      </div>
    </div>
  );
}
