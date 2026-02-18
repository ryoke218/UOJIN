// 店舗マスタ
export interface StoreMaster {
  inputName: string;    // 入力名（エイリアス）
  formalName: string;   // 正式店舗名
}

// 商品マスタ
export interface ProductMaster {
  productName: string;  // 正式商品名
  alias: string;        // 変換名
  supplier: string;     // 発注先
}

// 解析結果1行
export interface ParsedOrderLine {
  storeName: string;       // 店舗名（正式名）
  productName: string;     // 商品名
  quantity: string;        // 数量（商品名以降のテキストそのまま）
  alias: string;           // 変換名（商品マスタから）
  supplier: string;        // 発注先（商品マスタから）
  status: 'ok' | 'store-error' | 'product-error' | 'both-error';
  rawText: string;         // 元テキスト
}

// スプレッドシート書き込み用
export interface OrderRow {
  shippingDate: string;    // 発送日
  storeName: string;       // 店舗名（正式名）
  productName: string;     // 商品名（変換名優先）
  quantity: string;        // 数量
  supplier: string;        // 発注先
  processor: string;       // 処理者
  registeredAt: string;    // 登録日時
  seqNo?: number;          // 通し番号（サーバーサイドで採番）
}

// 解析結果全体
export interface ParseResult {
  lines: ParsedOrderLine[];
  dateAlert: string | null;  // 日付キーワード検知
  skippedLines: string[];    // スキップした行
}
