'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalkSession } from '@/lib/walkSession';
import { useT, type TKey } from '@/lib/i18n';

const TABS = [
  { href: '/', label: 'nav.home' as TKey, icon: '🏡' },
  { href: '/walk/', label: 'nav.walk' as TKey, icon: '🦮' },
  { href: '/history/', label: 'nav.history' as TKey, icon: '📖' },
  { href: '/closet/', label: 'nav.closet' as TKey, icon: '🎒' },
];

export default function BottomNav() {
  const path = usePathname() || '/';
  const walk = useWalkSession();
  const { t } = useT();
  if (path.startsWith('/create') || path.startsWith('/privacy')) return null;
  const norm = (p: string) => (p.endsWith('/') ? p : p + '/');
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-bark/10 bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-md">
        {TABS.map((tab) => {
          const active = tab.href === '/' ? path === '/' : norm(path).startsWith(tab.href);
          return (
            <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined} className={`relative flex flex-1 flex-col items-center justify-center text-[11px] font-bold ${active ? 'text-moss' : 'text-bark/60'}`}>
              <span aria-hidden className={`text-xl transition ${active ? 'scale-110' : ''}`}>{tab.icon}</span>
              {t(tab.label)}
              {tab.href === '/walk/' && walk.status !== 'idle' && (
                <span className={`absolute right-[30%] top-2 h-2.5 w-2.5 rounded-full ${walk.status === 'active' ? 'animate-pulse bg-berry' : 'bg-peach'}`} />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
