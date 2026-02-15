import { StoreMaster, ProductMaster, ParsedOrderLine, ParseResult } from '@/types/order';

// 挨拶文パターン（スキップ対象）
const GREETING_PATTERNS = [
  'お世話になっております',
  'お世話になります',
  'お世話様です',
  'お疲れ様です',
  'お疲れさまです',
  'おつかれさまです',
  'よろしくお願いします',
  'よろしくお願い致します',
  'よろしくお願いいたします',
  'よろしくおねがいします',
  '宜しくお願いします',
  '宜しくお願い致します',
  '宜しくお願いいたします',
  'お願いします',
  'お願い致します',
  'お願いいたします',
  'ありがとうございます',
  'いつもありがとうございます',
  'おはようございます',
  'こんにちは',
  'こんばんは',
  '失礼します',
  '失礼いたします',
  'すみません',
  '以上です',
  '以上になります',
  '以上でお願いします',
  '以上宜しくお願いします',
  '以上よろしくお願いします',
];

// 日付キーワード
const DATE_KEYWORDS = [
  '明日', '明後日', 'あさって', 'あした',
  '今日', '本日',
  '月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜',
  '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日',
];
const DATE_REGEX = /\d{1,2}日|(\d{1,2}月\d{1,2}日)/;

// LINEのタイムスタンプ行パターン（半角・全角コロン両対応）
const LINE_TIMESTAMP_REGEX = /^\d{1,2}[：:]\d{2}\s/;

/**
 * 全角数字を半角に変換
 */
function normalizeNumber(str: string): string {
  return str.replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
}

/**
 * 行の前後の空白を除去し、全角数字を半角に変換
 */
function normalizeLine(line: string): string {
  return normalizeNumber(line.trim());
}

/**
 * 挨拶文かどうか判定
 * 挨拶パターンを全て除去した後、残りが短ければ純粋な挨拶文とみなす
 */
function isGreeting(line: string): boolean {
  if (!GREETING_PATTERNS.some((pattern) => line.includes(pattern))) return false;
  let remaining = line;
  for (const pattern of GREETING_PATTERNS) {
    remaining = remaining.replaceAll(pattern, '');
  }
  // 句読点・記号・空白を除去して、実質的な内容が残っているか判定
  remaining = remaining.replace(/[、。！？\s　・「」『』（）(),.!?\-―]/g, '').trim();
  return remaining.length === 0;
}

/**
 * 店舗マスタから入力名に完全一致するものを探す
 */
function findStore(line: string, stores: StoreMaster[]): StoreMaster | null {
  return stores.find((s) => s.inputName === line) ?? null;
}

/**
 * 商品名を行から抽出し、残りをそのまま数量として返す
 */
function extractProduct(
  line: string,
  products: ProductMaster[]
): { product: ProductMaster; quantity: string } | null {
  const sorted = [...products].sort((a, b) => b.productName.length - a.productName.length);

  for (const product of sorted) {
    if (line.startsWith(product.productName)) {
      const rest = line.slice(product.productName.length).trim();
      return { product, quantity: rest };
    }
  }
  return null;
}

/**
 * テキスト内の日付キーワードを検知
 */
function detectDateKeywords(text: string): string | null {
  for (const keyword of DATE_KEYWORDS) {
    if (text.includes(keyword)) {
      return keyword;
    }
  }
  const match = text.match(DATE_REGEX);
  if (match) {
    return match[0];
  }
  return null;
}

// 行の分類結果
type ClassifiedLine =
  | { type: 'skip' }
  | { type: 'store'; store: StoreMaster }
  | { type: 'product'; product: ProductMaster; quantity: string; rawText: string }
  | { type: 'unknown'; rawText: string };

/**
 * 各行を分類
 */
function classifyLine(
  line: string,
  stores: StoreMaster[],
  products: ProductMaster[]
): ClassifiedLine {
  const normalized = normalizeLine(line);

  // 空行
  if (normalized === '') return { type: 'skip' };

  // LINEタイムスタンプ行を最優先で判定（"10:08 原 勇樹 ゆもとさん"）
  if (LINE_TIMESTAMP_REGEX.test(normalized)) {
    const afterTime = normalized.replace(LINE_TIMESTAMP_REGEX, '').trim();
    // 本文部分が挨拶文 → スキップ
    if (isGreeting(afterTime)) return { type: 'skip' };
    // 本文の末尾に店舗名が含まれるかチェック
    for (const s of stores) {
      if (afterTime.endsWith(s.inputName)) {
        return { type: 'store', store: s };
      }
    }
    // それ以外のタイムスタンプ行はスキップ
    return { type: 'skip' };
  }

  // 挨拶文
  if (isGreeting(normalized)) return { type: 'skip' };

  // 店舗マスタに完全一致
  const store = findStore(normalized, stores);
  if (store) return { type: 'store', store };

  // 商品マスタに一致
  const productMatch = extractProduct(normalized, products);
  if (productMatch) {
    return {
      type: 'product',
      product: productMatch.product,
      quantity: productMatch.quantity,
      rawText: normalized,
    };
  }

  // どれにも該当しない
  return { type: 'unknown', rawText: normalized };
}

/**
 * メイン解析関数
 */
export function parseOrderText(
  text: string,
  stores: StoreMaster[],
  products: ProductMaster[]
): ParseResult {
  const lines = text.split('\n');
  const classified = lines.map((line) => classifyLine(line, stores, products));

  const result: ParsedOrderLine[] = [];
  const skippedLines: string[] = [];

  const dateAlert = detectDateKeywords(text);

  type Block = {
    storeIndex: number | null;
    storePosition: 'before' | 'after' | null;
    store: StoreMaster | null;
    items: { index: number; classified: ClassifiedLine }[];
  };

  const blocks: Block[] = [];
  let currentBlock: Block = { storeIndex: null, storePosition: null, store: null, items: [] };

  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];
    if (c.type === 'skip') {
      const raw = normalizeLine(lines[i]);
      // 空行のみブロック区切り（挨拶文やタイムスタンプ行ではブロックを切らない）
      if (raw === '') {
        if (currentBlock.items.length > 0 || currentBlock.storeIndex !== null) {
          blocks.push(currentBlock);
          currentBlock = { storeIndex: null, storePosition: null, store: null, items: [] };
        }
      } else if (!isGreeting(raw)) {
        // 挨拶文以外のスキップ行を記録（タイムスタンプ行など）
        skippedLines.push(raw);
      }
      continue;
    }

    if (c.type === 'store') {
      if (currentBlock.items.length === 0 && currentBlock.store === null) {
        // ブロック内で最初の店舗（商品なし）
        currentBlock.storeIndex = i;
        currentBlock.storePosition = 'before';
        currentBlock.store = c.store;
      } else if (currentBlock.items.length === 0 && currentBlock.store !== null) {
        // 店舗が連続（楽㐂→マルコ等）: 前の店舗を別ブロックとして確定
        blocks.push(currentBlock);
        currentBlock = { storeIndex: i, storePosition: 'before', store: c.store, items: [] };
      } else {
        // 商品の後に店舗が来た
        currentBlock.storeIndex = i;
        currentBlock.storePosition = 'after';
        currentBlock.store = c.store;
        blocks.push(currentBlock);
        currentBlock = { storeIndex: null, storePosition: null, store: null, items: [] };
      }
      continue;
    }

    currentBlock.items.push({ index: i, classified: c });
  }
  if (currentBlock.items.length > 0 || currentBlock.storeIndex !== null) {
    blocks.push(currentBlock);
  }

  // store-only ブロックを隣接する items-only ブロックに統合
  // 後方優先: LINEでは「商品 → 店舗名」の順が多い（店舗名は商品の後に来る）
  // まず前のブロック（商品群）に店舗がなければそちらに統合
  // なければ次のブロックに統合
  // どちらも割当済みなら統合しない(store-error のまま)
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isStoreOnly = block.store !== null && block.items.length === 0;
    if (!isStoreOnly) continue;

    const prev = i > 0 ? blocks[i - 1] : null;
    const next = i < blocks.length - 1 ? blocks[i + 1] : null;
    const prevNeedsStore = prev !== null && prev.store === null && prev.items.length > 0;
    const nextNeedsStore = next !== null && next.store === null && next.items.length > 0;

    if (prevNeedsStore) {
      prev.store = block.store;
      prev.storeIndex = block.storeIndex;
      prev.storePosition = 'after';
      blocks.splice(i, 1);
      i--;
    } else if (nextNeedsStore) {
      next.store = block.store;
      next.storeIndex = block.storeIndex;
      next.storePosition = 'before';
      blocks.splice(i, 1);
      i--;
    }
  }

  for (const block of blocks) {
    for (const item of block.items) {
      const c = item.classified;

      if (c.type === 'product') {
        const storeName = block.store?.formalName ?? '';
        const hasStore = block.store !== null;
        result.push({
          storeName,
          productName: c.product.productName,
          quantity: c.quantity,
          alias: c.product.alias,
          supplier: c.product.supplier,
          status: hasStore ? 'ok' : 'store-error',
          rawText: c.rawText,
        });
      } else if (c.type === 'unknown') {
        const storeName = block.store?.formalName ?? '';
        const hasStore = block.store !== null;
        result.push({
          storeName,
          productName: c.rawText,
          quantity: '',
          alias: '',
          supplier: '',
          status: hasStore ? 'product-error' : 'both-error',
          rawText: c.rawText,
        });
      }
    }
  }

  return { lines: result, dateAlert, skippedLines };
}
