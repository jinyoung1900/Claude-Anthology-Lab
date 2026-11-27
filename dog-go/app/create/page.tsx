'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_PROPORTIONS, useStore } from '@/lib/store';
import { averageColor, cropRotated, fileToDownscaledDataUrl, loadImage, makeDefaultFace, makeFurTexture, type CropBox } from '@/lib/image';
import { uid } from '@/lib/storage';
import type { BreedId, DogMarkings, DogModel, DogProfile, DogProportions, EarStyle, TailStyle } from '@/lib/types';
import { applyBreed, BREEDS, normalizeDog } from '@/lib/breeds';
import { haptic } from '@/lib/feedback';
import { useT, type TKey } from '@/lib/i18n';
import TwoBoxCropper, { BOX_COLORS, type BoxId } from '@/components/TwoBoxCropper';
import type { DogAnim } from '@/components/three/Dog3D';
import PhotoButton from '@/components/PhotoButton';

const AvatarScene = dynamic(() => import('@/components/three/AvatarScene'), { ssr: false });

type Step = 'photo' | 'crop' | 'tune';
type Status = 'here' | 'away' | 'memorial';

const SLIDERS: { key: keyof DogProportions; label: TKey; min: number; max: number }[] = [
  { key: 'bodyLength', label: 'create.body', min: 0.6, max: 1.6 },
  { key: 'legLength', label: 'create.legs', min: 0.4, max: 1.6 },
  { key: 'earSize', label: 'create.ears', min: 0.4, max: 1.8 },
  { key: 'tailLength', label: 'create.tail', min: 0.2, max: 1.8 },
];
const TAILS: TailStyle[] = ['straight', 'plume', 'curled', 'stub'];
const ACCENTS = ['#FFFFFF', '#F4E3CF', '#F2D3A0', '#C98A55', '#3B2A20', '#111111'];
const PRESET_COLORS = ['#D9A066', '#3B2A20', '#F4E3CF', '#8A8A8A', '#B5651D', '#111111', '#E8D2A6'];

function Creator() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get('id');
  const wantsPhoto = params.get('photo') === '1';
  const { data, saveDog, setActiveDog } = useStore();
  const { t } = useT();
  const editing = useMemo(() => data.dogs.find((d) => d.id === editId) ?? null, [data.dogs, editId]);

  const [step, setStep] = useState<Step>(editing && !wantsPhoto ? 'tune' : 'photo');
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [face, setFace] = useState<CropBox>({ cx: 0, cy: 0, size: 100, rot: 0 });
  const [fur, setFur] = useState<CropBox>({ cx: 0, cy: 0, size: 60, rot: 0 });
  const [activeBox, setActiveBox] = useState<BoxId>('face');

  const [dog, setDog] = useState<DogProfile>(() =>
    normalizeDog(
      editing ?? {
        id: uid(),
        name: '',
        faceImg: '',
        furImg: '',
        furColor: '#D9A066',
        earStyle: 'floppy',
        proportions: { ...DEFAULT_PROPORTIONS },
        memorial: false,
        equipped: {},
        createdAt: Date.now(),
      },
    ),
  );
  const [anim, setAnim] = useState<DogAnim>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  // live crop → textures (debounced)
  useEffect(() => {
    if (!img) return;
    const id = setTimeout(() => {
      const faceC = cropRotated(img, face, 256);
      const furC = cropRotated(img, fur, 64, true);
      setDog((d) => ({ ...d, breed: d.breed ?? 'custom', faceImg: faceC.toDataURL('image/jpeg', 0.88), furImg: furC.toDataURL('image/png'), furColor: averageColor(furC) }));
    }, 120);
    return () => clearTimeout(id);
  }, [img, face, fur]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const url = await fileToDownscaledDataUrl(f);
    const im = await loadImage(url);
    const s = Math.min(im.width, im.height);
    setFace({ cx: im.width / 2, cy: im.height * 0.42, size: s * 0.5, rot: 0 });
    setFur({ cx: im.width / 2, cy: im.height * 0.82, size: s * 0.18, rot: 0 });
    setImg(im);
    // new photos default to the smooth sculpted dog
    setDog((d) => ({ ...d, model: 'sculpt' }));
    setActiveBox('face');
    setStep('crop');
  };

  const skipPhoto = (color: string) => {
    setImg(null);
    setDog((d) => ({ ...d, breed: 'custom', furColor: color, faceImg: makeDefaultFace(color), furImg: makeFurTexture(color) }));
    setStep('tune');
  };

  /** Start without a photo from a breed's pixel face + shape */
  const skipBreed = (id: Exclude<BreedId, 'custom'>) => {
    setImg(null);
    setDog((d) => applyBreed(d, id, true));
    setStep('tune');
  };

  /** Photo-made dogs keep their textures; preset-made dogs also swap the look. */
  const photoLook = !!img || (!!editing && (editing.breed ?? 'custom') === 'custom');
  const pickBreed = (id: BreedId) => {
    haptic('tick');
    if (id === 'custom') setDog((d) => ({ ...d, breed: 'custom' }));
    else setDog((d) => applyBreed(d, id, !photoLook));
  };
  const setMark = (k: keyof DogMarkings, v: boolean) => setDog((d) => ({ ...d, markings: { ...(d.markings ?? { chest: false, socks: false, tailTip: false }), [k]: v } }));
  const status: Status = dog.memorial ? 'memorial' : dog.away ? 'away' : 'here';
  const setStatus = (s: Status) => setDog((d) => ({ ...d, memorial: s === 'memorial', away: s === 'away' }));

  const box = activeBox === 'face' ? face : fur;
  const setBox = (b: CropBox) => (activeBox === 'face' ? setFace(b) : setFur(b));
  const imgMin = img ? Math.min(img.width, img.height) : 100;

  const save = () => {
    const final = { ...dog, name: dog.name.trim() || t('create.defaultName') };
    saveDog(final);
    setActiveDog(final.id);
    router.push(wantsPhoto ? '/' : '/closet/?tab=kennel');
  };

  const setProp = (k: keyof DogProportions, v: number) => setDog((d) => ({ ...d, proportions: { ...d.proportions, [k]: v } }));

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <header className="mb-3 flex items-center gap-3">
        <button
          className="btn-secondary px-3 py-2"
          aria-label={t('common.back')}
          onClick={() => (step === 'tune' && img ? setStep('crop') : step === 'crop' ? setStep('photo') : step === 'photo' && editing ? setStep('tune') : router.back())}
        >
          ←
        </button>
        <h1 className="flex-1 truncate text-xl font-black">{editing ? t('create.edit', { name: editing.name }) : t('create.title')}</h1>
        <span className="text-xs font-bold text-bark/50">{step === 'photo' ? '1' : step === 'crop' ? '2' : '3'} / 3</span>
      </header>

      {step === 'photo' && (
        <section className="space-y-4">
          <div className="card text-center">
            <div className="mb-2 text-5xl">📸</div>
            <h2 className="text-lg font-black">{t('create.uploadTitle')}</h2>
            <p className="mb-4 text-sm text-bark/60">{t('create.uploadHint')}</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn-primary w-full" onClick={() => fileRef.current?.click()}>
              {t('create.choose')}
            </button>
          </div>
          <div className="card">
            <p className="label mb-2">{t('create.noPhoto')}</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {BREEDS.map((b) => (
                <button key={b.id} className="btn-secondary py-2 text-sm" onClick={() => skipBreed(b.id)}>
                  {b.emoji} {t(`breed.${b.id}` as TKey)}
                </button>
              ))}
            </div>
            <p className="label mb-2">{t('create.orColor')}</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => skipPhoto(c)} className="h-10 w-10 rounded-full border-4 border-white shadow-chunky" style={{ background: c }} aria-label={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      {step === 'crop' && img && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['face', 'fur'] as BoxId[]).map((b) => (
              <button
                key={b}
                onClick={() => setActiveBox(b)}
                aria-pressed={activeBox === b}
                className={`rounded-2xl border-4 px-3 py-2 text-left text-sm font-bold ${activeBox === b ? 'bg-white' : 'border-transparent bg-white/50'}`}
                style={{ borderColor: activeBox === b ? BOX_COLORS[b] : undefined }}
              >
                {t(b === 'face' ? 'create.face' : 'create.fur')}
                <span className="block text-[11px] font-normal text-bark/60">{t(b === 'face' ? 'create.faceHint' : 'create.furHint')}</span>
              </button>
            ))}
          </div>

          <TwoBoxCropper image={img} face={face} fur={fur} active={activeBox} onActive={setActiveBox} onChange={(b, v) => (b === 'face' ? setFace(v) : setFur(v))} />
          <p className="text-center text-[11px] font-bold text-bark/60">{t('create.cropHint')}</p>

          <div className="card space-y-3">
            <label className="block">
              <span className="label">{t('create.size')}</span>
              <input type="range" min={imgMin * 0.05} max={imgMin} step={1} value={box.size} onChange={(e) => setBox({ ...box, size: +e.target.value })} />
            </label>
            {activeBox === 'face' && (
              <label className="block">
                <span className="label">{t('create.rotate', { n: Math.round((face.rot * 180) / Math.PI) })}</span>
                <input type="range" min={-Math.PI / 4} max={Math.PI / 4} step={0.01} value={face.rot} onChange={(e) => setFace({ ...face, rot: +e.target.value })} />
              </label>
            )}
            <div className="flex items-center gap-3">
              {dog.faceImg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.faceImg} alt="" className="h-16 w-16 rounded-lg border-4" style={{ borderColor: BOX_COLORS.face }} />
              )}
              {dog.furImg && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dog.furImg} alt="" className="h-16 w-16 rounded-lg border-4 [image-rendering:pixelated]" style={{ borderColor: BOX_COLORS.fur }} />
              )}
              <div className="h-10 w-10 rounded-full border-4 border-white shadow" style={{ background: dog.furColor }} />
            </div>
          </div>
          <button className="btn-primary w-full" onClick={() => setStep('tune')}>
            {t('create.looksGood')}
          </button>
        </section>
      )}

      {step === 'tune' && (
        <section className="space-y-3">
          <div className="relative overflow-hidden rounded-[2rem] shadow-chunky">
            <AvatarScene key={dog.model ?? 'sculpt'} dog={dog.faceImg ? dog : null} framing="dog" anim={anim} onDogTap={() => setAnim('happy')} className="h-72 w-full" initialYaw={0.6} />
            <PhotoButton onClick={() => setStep('photo')} />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-white/85 p-1">
              {(['idle', 'walk', 'happy', 'sit'] as DogAnim[]).map((a) => (
                <button key={a} onClick={() => setAnim(a)} aria-pressed={anim === a} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${anim === a ? 'bg-moss text-white' : ''}`}>
                  {t(`create.${a}` as TKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-3">
            <div>
              <span className="label">{t('create.model')}</span>
              <div className="mt-1 grid grid-cols-2 gap-1" role="radiogroup" aria-label={t('create.model')}>
                {(['sculpt', 'toon', 'plush', 'pixel'] as DogModel[]).map((m) => (
                  <button key={m} role="radio" aria-checked={(dog.model ?? 'sculpt') === m} onClick={() => setDog({ ...dog, model: m })} className={`min-h-11 rounded-xl text-sm font-bold ${(dog.model ?? 'sculpt') === m ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`model.${m}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">
                {t('create.breedShape')}
                {photoLook ? t('create.keepsPhoto') : ''}
              </span>
              <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
                {[{ id: 'custom' as BreedId, emoji: '✏️' }, ...BREEDS].map((b) => (
                  <button key={b.id} onClick={() => pickBreed(b.id)} aria-pressed={(dog.breed ?? 'custom') === b.id} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${(dog.breed ?? 'custom') === b.id ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {b.emoji} {b.id === 'custom' ? t('create.custom') : t(`breed.${b.id}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label">{t('create.name')}</span>
              <input className="input" placeholder={t('create.namePh')} value={dog.name} maxLength={20} onChange={(e) => setDog({ ...dog, name: e.target.value })} />
            </label>
            {SLIDERS.map((s) => (
              <label key={s.key} className="block">
                <span className="label">{t(s.label)}</span>
                <input type="range" min={s.min} max={s.max} step={0.01} value={dog.proportions[s.key]} onChange={(e) => setProp(s.key, +e.target.value)} />
              </label>
            ))}
            <div>
              <span className="label">{t('create.earStyle')}</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(['floppy', 'pointy'] as EarStyle[]).map((e) => (
                  <button key={e} aria-pressed={dog.earStyle === e} onClick={() => setDog({ ...dog, earStyle: e })} className={`rounded-xl py-2 text-sm font-bold ${dog.earStyle === e ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`ear.${e}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">{t('create.tail')}</span>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {TAILS.map((id) => (
                  <button key={id} aria-pressed={dog.tailStyle === id} onClick={() => setDog({ ...dog, tailStyle: id })} className={`rounded-xl py-2 text-xs font-bold ${dog.tailStyle === id ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`tail.${id}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="label">{t('create.fluff')}</span>
              <input type="range" min={0} max={1} step={0.01} value={dog.fluff ?? 0.2} onChange={(e) => setDog({ ...dog, fluff: +e.target.value })} />
            </label>
            <div>
              <span className="label">{t('create.accent')}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {ACCENTS.map((c) => (
                  <button key={c} onClick={() => setDog({ ...dog, accentColor: c })} aria-pressed={dog.accentColor === c} className={`h-8 w-8 rounded-full border-4 shadow ${dog.accentColor === c ? 'border-moss' : 'border-white'}`} style={{ background: c }} aria-label={c} />
                ))}
                <input type="color" value={dog.accentColor ?? '#F4E3CF'} onChange={(e) => setDog({ ...dog, accentColor: e.target.value })} className="h-8 w-8 rounded-full border-0 bg-transparent" aria-label={t('create.accent')} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1">
                {(['chest', 'socks', 'tailTip'] as (keyof DogMarkings)[]).map((k) => (
                  <button key={k} aria-pressed={!!dog.markings?.[k]} onClick={() => setMark(k, !dog.markings?.[k])} className={`rounded-xl py-2 text-xs font-bold ${dog.markings?.[k] ? 'bg-moss text-white' : 'bg-cream'}`}>
                    {t(`mark.${k}` as TKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-cream p-3">
              <span className="label">{t('create.status')}</span>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(['here', 'away', 'memorial'] as Status[]).map((s) => (
                  <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-xl px-1 py-2 text-xs font-bold ${status === s ? 'bg-moss text-white' : 'bg-white'}`}>
                    {t(`status.${s}` as TKey)}
                  </button>
                ))}
              </div>
              {status !== 'here' && <p className="mt-2 text-xs text-bark/60">{t('create.memorialHint')}</p>}
            </div>
          </div>

          {!img && (
            <button className="btn-secondary w-full text-sm" onClick={() => setStep('photo')}>
              {t('create.usePhoto')}
            </button>
          )}
          <button className="btn-primary w-full py-4 text-lg" onClick={save} disabled={!dog.faceImg}>
            {editing ? t('create.saveChanges') : t('create.adopt')}
          </button>
        </section>
      )}
    </main>
  );
}

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <Creator />
    </Suspense>
  );
}
