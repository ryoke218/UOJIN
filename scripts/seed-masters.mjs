#!/usr/bin/env node

/**
 * マスタデータ一括投入スクリプト
 *
 * 使い方:
 *   1. Next.js アプリを起動 (npm run dev)
 *   2. node scripts/seed-masters.mjs
 *
 * オプション:
 *   --stores-only   店舗マスタのみ
 *   --products-only  商品マスタのみ
 *   --dry-run        実際には投入せず確認のみ
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ============================================================
// 店舗マスタ
// inputName: LINEメッセージに出てくる表記（完全一致でマッチ）
// formalName: 正式店舗名（出力に使われる）
// ============================================================
const STORES = [
  // --- 渋谷きんぼし ---
  { inputName: '渋谷きんぼし', formalName: '渋谷きんぼし' },

  // --- 金田 ---
  { inputName: '金田さん', formalName: '金田' },
  { inputName: '金田', formalName: '金田' },

  // --- ゴエンサン ---
  { inputName: 'ゴエンサン', formalName: 'ゴエンサン' },

  // --- アピ ---
  { inputName: 'アピさん', formalName: 'アピ' },
  { inputName: 'アピ', formalName: 'アピ' },

  // --- マルコ ---
  { inputName: 'マルコ', formalName: 'マルコ' },
  { inputName: 'マルコさん', formalName: 'マルコ' },

  // --- ニューマルコ ---
  { inputName: 'ニューマルコ', formalName: 'ニューマルコ' },
  { inputName: 'ニューマルコです。', formalName: 'ニューマルコ' },
  { inputName: 'ニューマルコです', formalName: 'ニューマルコ' },

  // --- 下北六角 ---
  { inputName: '下北六角', formalName: '下北六角' },

  // --- コマル ---
  { inputName: 'コマル', formalName: 'コマル' },
  { inputName: 'コマルです。', formalName: 'コマル' },
  { inputName: 'コマルです', formalName: 'コマル' },

  // --- びゃく ---
  { inputName: 'びゃく', formalName: 'びゃく' },

  // --- 三軒茶屋せきらら ---
  { inputName: '三軒茶屋せきらら', formalName: '三軒茶屋せきらら' },

  // --- 坂の花 ---
  { inputName: '坂の花', formalName: '坂の花' },

  // --- ハナミチ東京 ---
  { inputName: 'ハナミチ東京', formalName: 'ハナミチ東京' },

  // --- 酒トナデシコ七変化 ---
  { inputName: '酒トナデシコ七変化', formalName: '酒トナデシコ七変化' },

  // --- 若竹 ---
  { inputName: '若竹', formalName: '若竹' },

  // --- まる家 ---
  { inputName: 'まる家', formalName: 'まる家' },

  // --- 虎徹 ---
  { inputName: '虎徹さん', formalName: '虎徹' },
  { inputName: '虎徹', formalName: '虎徹' },

  // --- 楽㐂 ---
  { inputName: '楽㐂さん', formalName: '楽㐂' },
  { inputName: '楽㐂', formalName: '楽㐂' },

  // --- カド（営業担当？若竹・まる家の取りまとめ） ---
  { inputName: 'カドさん', formalName: 'カド' },
  { inputName: 'カド', formalName: 'カド' },
];

// ============================================================
// 商品マスタ
// productName: LINEメッセージの行頭で前方一致マッチ（長い名前が優先）
// alias: 変換名（同一商品の正式名など。空でもOK）
// ============================================================
const PRODUCTS = [
  // --- 鮮魚 ---
  { productName: '本マグロ', alias: '' },
  { productName: '本鮪', alias: '本マグロ' },
  { productName: 'まぐろ頬肉', alias: '' },
  { productName: '真鯛', alias: '' },
  { productName: '養殖真鯛', alias: '' },
  { productName: 'たい', alias: '真鯛' },
  { productName: '鰤', alias: '' },
  { productName: '天然ブリ', alias: '鰤' },
  { productName: '冷凍鰤フィーレ', alias: '' },
  { productName: '鰆', alias: '' },
  { productName: 'サワラ', alias: '鰆' },
  { productName: '黒鯛', alias: '' },
  { productName: '甘鯛', alias: '' },
  { productName: 'ヒラメ', alias: '' },
  { productName: '縞鯵', alias: '' },
  { productName: 'サバフィレ', alias: '' },
  { productName: 'サバ', alias: '' },
  { productName: '鱧板', alias: '' },
  { productName: '身欠きショウサイフグ小', alias: '' },
  { productName: 'ワカサギ', alias: '' },

  // --- 貝・甲殻類 ---
  { productName: '北海アサリ', alias: '' },
  { productName: 'アオリイカ', alias: '' },
  { productName: '安牡丹海老', alias: '' },
  { productName: 'さいまきえび', alias: '' },
  { productName: '海老安', alias: '' },
  { productName: '大ズワイガニ', alias: '' },
  { productName: '大ズワイ', alias: '大ズワイガニ' },
  { productName: 'ハマグリ', alias: '' },
  { productName: 'ホンビノス', alias: '' },
  { productName: '磯つぶ', alias: '' },
  { productName: 'つぶ貝', alias: '' },
  { productName: 'マツブ', alias: 'つぶ貝' },
  { productName: 'ムキつぶ貝', alias: '' },

  // --- うに・いくら ---
  { productName: 'うに', alias: '' },
  { productName: 'いくら', alias: '' },
  { productName: 'イクラ', alias: 'いくら' },
  { productName: '白子', alias: '' },
  { productName: 'とびっこゴールド', alias: '' },

  // --- 練り物・揚げ物 ---
  { productName: 'カニクリームコロッケ', alias: '' },
  { productName: 'ズワイガニクリームコロッケ', alias: 'カニクリームコロッケ' },
  { productName: 'カニコロ', alias: 'カニクリームコロッケ' },
  { productName: 'エビフライ', alias: '' },
  { productName: 'アジフライ', alias: '' },
  { productName: 'エビさつま揚げ', alias: '' },
  { productName: '栃尾揚げ', alias: '' },
  { productName: 'はんぺん', alias: '' },

  // --- 加工品・珍味 ---
  { productName: 'ネギトロ', alias: '' },
  { productName: '明太子', alias: '' },
  { productName: 'カニフレーク', alias: '' },
  { productName: '蟹フレーク', alias: 'カニフレーク' },
  { productName: '蟹味噌', alias: '' },
  { productName: '梅水晶', alias: '' },
  { productName: 'エイヒレ', alias: '' },
  { productName: '塩辛', alias: '' },
  { productName: 'ホヤ塩辛', alias: '' },
  { productName: '肝いりイカ', alias: '' },
  { productName: '奈良漬け', alias: '' },
  { productName: '長芋わさび', alias: '' },
  { productName: '赤こんにゃく', alias: '' },
  { productName: '白滝', alias: '' },
  { productName: 'よもぎふ', alias: '' },
  { productName: '白身すり身', alias: '' },

  // --- 野菜・薬味・海藻 ---
  { productName: '花穂紫蘇', alias: '' },
  { productName: '花穂', alias: '花穂紫蘇' },
  { productName: '紅だて', alias: '' },
  { productName: '南天の葉', alias: '' },
  { productName: '南天', alias: '南天の葉' },
  { productName: '芽ねぎ', alias: '' },
  { productName: 'わさび', alias: '' },
  { productName: 'すだち', alias: '' },
  { productName: '柚子大根', alias: '' },
  { productName: '新あおさのり', alias: '' },
  { productName: '生海苔', alias: '' },

  // --- その他 ---
  { productName: '生ザーサイ', alias: '' },
  { productName: '青ザーサイ', alias: '' },
  { productName: 'ザーサイ', alias: '' },
  { productName: 'とろゆば', alias: '' },
  { productName: 'あや錦', alias: '' },
  { productName: '綾錦', alias: 'あや錦' },
];

// ============================================================
// 実行
// ============================================================

const args = process.argv.slice(2);
const storesOnly = args.includes('--stores-only');
const productsOnly = args.includes('--products-only');
const dryRun = args.includes('--dry-run');

async function seedStores() {
  console.log(`\n=== 店舗マスタ (${STORES.length}件) ===`);
  if (dryRun) {
    for (const s of STORES) {
      console.log(`  [DRY] ${s.inputName} → ${s.formalName}`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const store of STORES) {
    try {
      const res = await fetch(`${BASE_URL}/api/stores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(store),
      });
      if (res.ok) {
        console.log(`  ✓ ${store.inputName} → ${store.formalName}`);
        ok++;
      } else {
        const err = await res.json();
        console.error(`  ✗ ${store.inputName}: ${err.error}`);
        fail++;
      }
    } catch (e) {
      console.error(`  ✗ ${store.inputName}: ${e.message}`);
      fail++;
    }
  }
  console.log(`  結果: 成功=${ok} 失敗=${fail}`);
}

async function seedProducts() {
  console.log(`\n=== 商品マスタ (${PRODUCTS.length}件) ===`);
  if (dryRun) {
    for (const p of PRODUCTS) {
      const aliasLabel = p.alias ? ` (alias: ${p.alias})` : '';
      console.log(`  [DRY] ${p.productName}${aliasLabel}`);
    }
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const product of PRODUCTS) {
    try {
      const res = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });
      if (res.ok) {
        const aliasLabel = product.alias ? ` (alias: ${product.alias})` : '';
        console.log(`  ✓ ${product.productName}${aliasLabel}`);
        ok++;
      } else {
        const err = await res.json();
        console.error(`  ✗ ${product.productName}: ${err.error}`);
        fail++;
      }
    } catch (e) {
      console.error(`  ✗ ${product.productName}: ${e.message}`);
      fail++;
    }
  }
  console.log(`  結果: 成功=${ok} 失敗=${fail}`);
}

async function main() {
  console.log(`マスタデータ投入 → ${BASE_URL}`);
  if (dryRun) console.log('(DRY RUN モード)');

  if (!productsOnly) await seedStores();
  if (!storesOnly) await seedProducts();

  console.log('\n完了！');
}

main().catch((e) => {
  console.error('エラー:', e);
  process.exit(1);
});
