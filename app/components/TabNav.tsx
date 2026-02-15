'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: '受注入力' },
  { href: '/stores', label: '店舗マスタ' },
  { href: '/products', label: '商品マスタ' },
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 text-center py-3 min-h-[44px] text-sm font-medium transition-colors ${
              isActive
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
