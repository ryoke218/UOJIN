'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * sessionStorage と連携する useState フック
 * ページ遷移後もデータを保持し、タブを閉じるまで維持する
 */
export function usePersistedState<T>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored) as T;
      }
    } catch (e) {
      console.warn(`Failed to parse sessionStorage key "${key}":`, e);
    }
    return initialValue;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.warn(`Failed to save to sessionStorage key "${key}":`, e);
    }
  }, [key, state]);

  const clearState = useCallback(() => {
    setState(initialValue);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  }, [key, initialValue]);

  return [state, setState, clearState];
}
