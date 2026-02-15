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
 * 注文前文かどうか判定
 * 「本日の注文お願いします」「明日のご注文よろしくお願いします」等
 */
function isOrderPreamble(line: string): boolean {
  const preambleBase = /^(本日|明日|今日|明後日)?(の)?(ご)?(注文|発注)(を)?/;
  if (!preambleBase.test(line)) return false;
  const afterPreamble = line.replace(preambleBase, '');
  let remaining = afterPreamble;
  for (const pattern of GREETING_PATTERNS) {
    remaining = remaining.replaceAll(pattern, '');
  }
  remaining = remaining.replace(/[、。！？\s　・「」『』（）(),.!?\-―]/g, '').trim();
  return remaining.length === 0;
}

// 店舗名の後ろに付く敬称・接尾辞
const STORE_SUFFIXES = ['さん', 'さんです', 'です', '様'];

/**
 * 店舗マスタから入力名に一致するものを探す（敬称付きも対応）
 */
function findStore(line: string, stores: StoreMaster[]): StoreMaster | null {
  // 完全一致
  const exact = stores.find((s) => s.inputName === line);
  if (exact) return exact;
  // 敬称を除去して再チェック
  for (const suffix of STORE_SUFFIXES) {
    if (line.endsWith(suffix)) {
      const stripped = line.slice(0, -suffix.length);
      const match = stores.find((s) => s.inputName === stripped);
      if (match) return match;
    }
  }
  return null;
}

/**
 * テキスト末尾から店舗名を検出（タイムスタンプ行用、敬称付き対応）
 */
function findStoreAtEnd(text: string, stores: StoreMaster[]): StoreMaster | null {
  for (const s of stores) {
    if (text.endsWith(s.inputName)) return s;
    for (const suffix of STORE_SUFFIXES) {
      if (text.endsWith(s.inputName + suffix)) return s;
    }
  }
  return null;
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
  | { type: 'boundary' }  // メッセージ境界（LINEタイムスタンプ行等）
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
  // タイムスタンプ行は新メッセージの開始を示すため、店舗以外はboundary（セグメント分割点）として扱う
  if (LINE_TIMESTAMP_REGEX.test(normalized)) {
    const afterTime = normalized.replace(LINE_TIMESTAMP_REGEX, '').trim();
    // 本文の末尾に店舗名が含まれるかチェック（敬称付き対応）
    const storeInTimestamp = findStoreAtEnd(afterTime, stores);
    if (storeInTimestamp) return { type: 'store', store: storeInTimestamp };
    // 店舗名を含まないタイムスタンプ行 → メッセージ境界
    return { type: 'boundary' };
  }

  // 挨拶文・注文前文 → メッセージ境界として扱う
  // タイムスタンプがない場合でも「宜しくお願いします」「お世話になります」等がセグメント分割点になる
  if (isGreeting(normalized)) return { type: 'boundary' };
  if (isOrderPreamble(normalized)) return { type: 'boundary' };

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
 *
 * フラットシーケンス方式:
 * 1. 全行を分類（店舗/商品/unknown/skip）
 * 2. skip以外をフラットな配列に並べる
 * 3. 店舗と店舗の間の商品群を「セグメント」として切り出す
 * 4. 各セグメントを隣接する店舗に割当:
 *    - 前の店舗にまだ商品がなければ → 前の店舗（前方割当）
 *    - 前の店舗に既に商品があれば → 後の店舗（後方割当）
 */
export function parseOrderText(
  text: string,
  stores: StoreMaster[],
  products: ProductMaster[]
): ParseResult {
  const lines = text.split('\n');
  const classified = lines.map((line) => classifyLine(line, stores, products));
  const dateAlert = detectDateKeywords(text);
  const skippedLines: string[] = [];

  // Step 1: フラットシーケンス構築（skip行を除外、boundary行はセグメント分割点として保持）
  type FlatItem =
    | { type: 'store'; store: StoreMaster }
    | { type: 'product'; product: ProductMaster; quantity: string; rawText: string }
    | { type: 'unknown'; rawText: string }
    | { type: 'boundary' };

  const flatItems: FlatItem[] = [];

  for (let i = 0; i < classified.length; i++) {
    const c = classified[i];
    if (c.type === 'skip') {
      const raw = normalizeLine(lines[i]);
      if (raw !== '') {
        skippedLines.push(raw);
      }
      continue;
    }
    if (c.type === 'boundary') {
      flatItems.push({ type: 'boundary' });
      continue;
    }
    if (c.type === 'store') {
      flatItems.push({ type: 'store', store: c.store });
    } else if (c.type === 'product') {
      flatItems.push({ type: 'product', product: c.product, quantity: c.quantity, rawText: c.rawText });
    } else {
      flatItems.push({ type: 'unknown', rawText: c.rawText });
    }
  }

  // Step 2: 店舗位置を特定
  const storeIndices: number[] = [];
  for (let i = 0; i < flatItems.length; i++) {
    if (flatItems[i].type === 'store') storeIndices.push(i);
  }

  // Step 3: セグメント（店舗間の商品群）を切り出す
  type Segment = {
    start: number;        // flatItems内の開始インデックス
    end: number;          // flatItems内の終了インデックス
    storeBefore: number | null;  // セグメント前の店舗（flatItemsインデックス）
    storeAfter: number | null;   // セグメント後の店舗（flatItemsインデックス）
  };

  const segments: Segment[] = [];
  let segStart = 0;

  for (let i = 0; i <= flatItems.length; i++) {
    if (i === flatItems.length || flatItems[i].type === 'store' || flatItems[i].type === 'boundary') {
      if (segStart < i) {
        const storeBefore = storeIndices.filter((si) => si < segStart).pop() ?? null;
        // boundary で分割された場合も、次の店舗を探す
        const storeAfter = storeIndices.find((si) => si >= i) ?? null;
        segments.push({ start: segStart, end: i - 1, storeBefore, storeAfter });
      }
      segStart = i + 1;
    }
  }

  // Step 4: セグメントを店舗に割当
  const itemStoreMap = new Map<number, StoreMaster>();
  const storesWithItems = new Set<number>();

  for (const seg of segments) {
    let assignTo: number | null = null;

    if (seg.storeBefore !== null && !storesWithItems.has(seg.storeBefore)) {
      // 前の店舗にまだ商品がない → 前方割当
      assignTo = seg.storeBefore;
    } else if (seg.storeAfter !== null) {
      // 後方割当（後の店舗に割当）
      assignTo = seg.storeAfter;
    } else if (seg.storeBefore !== null) {
      // 後の店舗がない → 前の店舗に追加
      assignTo = seg.storeBefore;
    }

    if (assignTo !== null) {
      const store = (flatItems[assignTo] as { type: 'store'; store: StoreMaster }).store;
      let hasProduct = false;
      for (let j = seg.start; j <= seg.end; j++) {
        itemStoreMap.set(j, store);
        if (flatItems[j].type === 'product') hasProduct = true;
      }
      // unknown行だけのセグメントでは「商品あり」とみなさない
      // これにより前文テキスト等が店舗割当を狂わせることを防ぐ
      if (hasProduct) {
        storesWithItems.add(assignTo);
      }
    }
  }

  // Step 5: 結果構築
  const result: ParsedOrderLine[] = [];

  for (let i = 0; i < flatItems.length; i++) {
    const item = flatItems[i];
    if (item.type === 'store' || item.type === 'boundary') continue;

    const store = itemStoreMap.get(i) ?? null;

    if (item.type === 'product') {
      result.push({
        storeName: store?.formalName ?? '',
        productName: item.product.productName,
        quantity: item.quantity,
        alias: item.product.alias,
        supplier: item.product.supplier,
        status: store ? 'ok' : 'store-error',
        rawText: item.rawText,
      });
    } else {
      result.push({
        storeName: store?.formalName ?? '',
        productName: item.rawText,
        quantity: '',
        alias: '',
        supplier: '',
        status: store ? 'product-error' : 'both-error',
        rawText: item.rawText,
      });
    }
  }

  return { lines: result, dateAlert, skippedLines };
}
