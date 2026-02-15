'use client';

import { useState, useEffect, useCallback } from 'react';
import { StoreMaster } from '@/types/order';

export default function StoresPage() {
  const [stores, setStores] = useState<StoreMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newInputName, setNewInputName] = useState('');
  const [newFormalName, setNewFormalName] = useState('');
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editInputName, setEditInputName] = useState('');
  const [editFormalName, setEditFormalName] = useState('');
  const [message, setMessage] = useState('');

  const loadStores = useCallback(async () => {
    try {
      const res = await fetch('/api/stores');
      const data = await res.json();
      if (Array.isArray(data)) setStores(data);
    } catch (error) {
      console.error('Failed to load stores:', error);
      setMessage('店舗マスタの読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const handleAdd = async () => {
    if (!newInputName.trim() || !newFormalName.trim()) return;
    setMessage('');
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputName: newInputName.trim(), formalName: newFormalName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setNewInputName('');
        setNewFormalName('');
        await loadStores();
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
    setEditInputName(stores[index].inputName);
    setEditFormalName(stores[index].formalName);
  };

  const handleSaveEdit = async () => {
    if (editIndex === null || !editInputName.trim() || !editFormalName.trim()) return;
    setMessage('');
    try {
      const res = await fetch('/api/stores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowIndex: editIndex,
          inputName: editInputName.trim(),
          formalName: editFormalName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditIndex(null);
        await loadStores();
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
    if (!confirm(`「${stores[index].inputName}」を削除しますか？`)) return;
    setMessage('');
    try {
      const res = await fetch('/api/stores', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: index }),
      });
      const data = await res.json();
      if (data.success) {
        await loadStores();
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
      <h1 className="text-lg font-bold">店舗マスタ</h1>

      {/* 追加フォーム */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={newInputName}
            onChange={(e) => setNewInputName(e.target.value)}
            placeholder="入力名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={newFormalName}
            onChange={(e) => setNewFormalName(e.target.value)}
            placeholder="正式店舗名"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!newInputName.trim() || !newFormalName.trim()}
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
      {stores.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">店舗マスタが登録されていません</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 border-b font-medium">入力名</th>
                <th className="text-left px-3 py-2 border-b font-medium">正式店舗名</th>
                <th className="text-center px-2 py-2 border-b font-medium w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {editIndex === i ? (
                    <>
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={editInputName}
                          onChange={(e) => setEditInputName(e.target.value)}
                          className="w-full border border-blue-300 rounded px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2 border-b">
                        <input
                          type="text"
                          value={editFormalName}
                          onChange={(e) => setEditFormalName(e.target.value)}
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
                      <td className="px-3 py-2 border-b">{store.inputName}</td>
                      <td className="px-3 py-2 border-b">{store.formalName}</td>
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
        {stores.length}件登録済み
      </div>
    </div>
  );
}
