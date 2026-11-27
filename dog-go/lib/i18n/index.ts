'use client';

/**
 * Tiny i18n: flat string tables per language + `{var}` interpolation.
 * Language lives in Settings (picked in onboarding or Settings → Language).
 */
import en, { type Dict } from './en';
import ko from './ko';
import fi from './fi';
import type { Lang } from '../types';
import { useStore } from '../store';

export type TKey = keyof Dict;
export type TFn = (key: TKey, vars?: Record<string, string | number>) => string;

export const DICTS: Record<Lang, Dict> = { en, ko, fi };
export const LANGS: { id: Lang; label: string; flag: string }[] = [
  { id: 'en', label: 'English', flag: '🇬🇧' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'fi', label: 'Suomi', flag: '🇫🇮' },
];

export function makeT(lang: Lang): TFn {
  const d = DICTS[lang] ?? en;
  return (key, vars) => {
    let s = d[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

/** Hook: `const { t, lang } = useT()` */
export function useT() {
  const { settings } = useStore();
  const lang = settings.language ?? 'en';
  return { t: makeT(lang), lang };
}

/* ---------------- trinket names ---------------- */
const TRINKET_NAMES: Record<string, [string, string, string]> = {
  // id: [en, ko, fi]
  'bandana-red': ['Red Bandana', '빨간 반다나', 'Punainen huivi'],
  'bandana-sun': ['Sunny Bandana', '노란 반다나', 'Aurinkohuivi'],
  'collar-blue': ['Blue Collar', '파란 목줄', 'Sininen kaulapanta'],
  'collar-leather': ['Leather Collar', '가죽 목줄', 'Nahkapanta'],
  'beanie-green': ['Moss Beanie', '이끼색 비니', 'Sammalpipo'],
  'glasses-round': ['Round Specs', '동그란 안경', 'Pyöreät lasit'],
  partyhat: ['Party Hat', '파티 모자', 'Juhlahattu'],
  flowercrown: ['Flower Crown', '꽃 화관', 'Kukkaseppele'],
  sunglasses: ['Cool Shades', '멋쟁이 선글라스', 'Siistit aurinkolasit'],
  bowtie: ['Dapper Bow Tie', '멋쟁이 나비넥타이', 'Hieno rusetti'],
  backpack: ['Explorer Pack', '탐험가 배낭', 'Tutkijan reppu'],
  crown: ['Golden Crown', '황금 왕관', 'Kultainen kruunu'],
  tophat: ['Fancy Top Hat', '고급 실크햇', 'Hieno silinteri'],
  halo: ['Rainbow Halo', '무지개 후광', 'Sateenkaarisädekehä'],
  starshades: ['Star Shades', '별 선글라스', 'Tähtilasit'],
  jetpack: ['Tiny Jetpack', '꼬마 제트팩', 'Pikkuinen rakettireppu'],
  'sweater-red': ['Cozy Knit Sweater', '포근한 니트 스웨터', 'Lämmin neulepusero'],
  raincoat: ['Puddle Raincoat', '물웅덩이 우비', 'Lätäkkösadetakki'],
  tuxedo: ['Tiny Tuxedo', '꼬마 턱시도', 'Pikkuinen smokki'],
  dino: ['Dino Suit', '공룡 옷', 'Dinoasu'],
  'cape-hero': ['Hero Cape', '히어로 망토', 'Sankariviitta'],
  'harness-blue': ['Trail Harness', '산책 하네스', 'Retkivaljaat'],
  'harness-pink': ['Comfy Pink Harness', '포근한 분홍 하네스', 'Mukavat pinkit valjaat'],
  bee: ['Bumble Bee Suit', '꿀벌 옷', 'Kimalaisasu'],
  frog: ['Froggy Suit', '개구리 옷', 'Sammakkoasu'],
  bear: ['Teddy Bear Suit', '곰돌이 옷', 'Nalleasu'],
  unicorn: ['Unicorn Suit', '유니콘 옷', 'Yksisarvisasu'],
  'medal-streak': ['7-Day Streak Medal', '7일 연속 메달', '7 päivän putkimitali'],
  'medal-goal': ['Goal Getter Medal', '목표 달성 메달', 'Tavoitemitali'],
  santahat: ['Santa Hat', '산타 모자', 'Tonttulakki'],
  'scarf-winter': ['Cozy Scarf', '포근한 목도리', 'Lämmin kaulahuivi'],
  pumpkin: ['Pumpkin Hat', '호박 모자', 'Kurpitsahattu'],
  leafcrown: ['Autumn Leaf Crown', '단풍 화관', 'Syyslehtiseppele'],
  sakura: ['Cherry Blossom Crown', '벚꽃 화관', 'Kirsikankukkaseppele'],
  strawhat: ['Straw Sun Hat', '밀짚모자', 'Olkihattu'],
};

export function trinketName(id: string, lang: Lang) {
  const n = TRINKET_NAMES[id];
  if (!n) return id;
  return n[lang === 'ko' ? 1 : lang === 'fi' ? 2 : 0];
}

export const dateLocale = (lang: Lang) => (lang === 'ko' ? 'ko-KR' : lang === 'fi' ? 'fi-FI' : 'en-GB');
