'use client';

import { openAppSettings } from '@/lib/geo';
import { useT } from '@/lib/i18n';

/** Explains how to stop Android from killing background walk tracking. */
export default function BatteryTip({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-bark/60 sm:items-center" onClick={onClose} role="dialog" aria-modal>
      <div className="w-full max-w-md animate-pop space-y-3 rounded-t-[2rem] bg-cream p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-[2rem]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-black">{t('bt.title')}</h2>
        <p className="text-sm text-bark/80">{t('bt.body')}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{t('bt.s1')}</li>
          <li>{t('bt.s2')}</li>
          <li>{t('bt.s3')}</li>
          <li>{t('bt.s4')}</li>
        </ol>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secondary" onClick={() => void openAppSettings()}>
            {t('bt.open')}
          </button>
          <button className="btn-primary" onClick={onClose}>
            {t('bt.gotIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
