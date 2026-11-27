'use client';

/**
 * Privacy policy (required by Google Play for apps using location).
 * Before publishing: replace CONTACT with a real support email, and update the
 * "Ads" section once real AdMob is integrated.
 */
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import type { Lang } from '@/lib/types';

const UPDATED = '2026-11-26';
const CONTACT = 'the developer contact listed on the Google Play store page';

type Section = [title: string, body: string];

const POLICY: Record<Lang, Section[]> = {
  en: [
    ['Summary', 'Dog-go works without an account and without a server. Everything you create, dogs, photos, walks, routes, notes and settings, is stored only on your device. We do not collect, sell or share your personal data.'],
    ['Location', 'With your permission, Dog-go uses your device’s GPS while a walk is being recorded, to draw your route, measure distance and place flowers and finds along the way. On Android, a “Walk in progress” notification lets tracking continue with the screen off. Location is never sent to us or to third parties. Map images are loaded from OpenStreetMap tile servers, which, like any website, receive your IP address and the map area being viewed, but not your GPS position history.'],
    ['Photos & camera', 'Dog photos you choose for the dog creator and photos you take on walks are processed and stored on your device only. They leave your device only if you share a walk card or save a backup yourself.'],
    ['Notifications', 'Used only for the optional daily walk reminder you set, and for the walk-in-progress notice. You can turn them off in Settings or in your phone’s settings at any time.'],
    ['Ads', 'This version only shows placeholder (mock) ads; no ad SDK is included and no advertising identifiers are collected. If real ads are added in a future version, this policy will be updated first and will explain what the ad provider collects.'],
    ['Backups & sharing', 'Backups and share cards are files created on your device. Where they go is up to you (for example Google Drive or a messaging app); those services’ own privacy policies apply.'],
    ['Deleting your data', 'Delete individual walks or dogs in the app, or uninstall Dog-go to remove everything. Because we hold no copy, uninstalling is permanent unless you saved a backup.'],
    ['Children', 'Dog-go is suitable for all ages and does not knowingly collect personal information from anyone, including children.'],
    ['Contact', `Questions? Reach us via ${CONTACT}.`],
  ],
  ko: [
    ['요약', 'Dog-go는 계정이나 서버 없이 작동해요. 강아지, 사진, 산책, 경로, 메모, 설정 등 만든 모든 것은 기기에만 저장돼요. 개인정보를 수집하거나 판매·공유하지 않아요.'],
    ['위치', '허용하신 경우, 산책을 기록하는 동안에만 기기의 GPS로 경로를 그리고 거리를 재며 꽃과 발견물을 배치해요. 안드로이드에서는 "산책 중" 알림 덕분에 화면이 꺼져도 기록이 이어져요. 위치 정보는 저희나 제3자에게 전송되지 않아요. 지도 이미지는 OpenStreetMap 타일 서버에서 불러오며, 일반 웹사이트처럼 IP 주소와 보고 있는 지도 영역은 전달되지만 GPS 이동 기록은 전달되지 않아요.'],
    ['사진 및 카메라', '강아지 만들기에 사용하는 사진과 산책 중 찍은 사진은 기기 안에서만 처리·저장돼요. 직접 산책 카드를 공유하거나 백업을 저장할 때만 기기 밖으로 나가요.'],
    ['알림', '직접 설정한 매일 산책 알림과 "산책 중" 알림에만 사용돼요. 설정이나 휴대폰 설정에서 언제든 끌 수 있어요.'],
    ['광고', '이 버전은 테스트용(가상) 광고만 표시하며, 광고 SDK가 포함되어 있지 않고 광고 식별자도 수집하지 않아요. 앞으로 실제 광고가 추가되면 먼저 이 방침을 업데이트하여 광고 제공자가 수집하는 정보를 안내할게요.'],
    ['백업 및 공유', '백업 파일과 산책 카드는 기기에서 만들어지는 파일이에요. 저장 위치(예: Google 드라이브, 메신저)는 직접 선택하며, 해당 서비스의 개인정보 처리방침이 적용돼요.'],
    ['데이터 삭제', '앱에서 산책이나 강아지를 개별 삭제하거나, 앱을 삭제하면 모든 데이터가 지워져요. 저희는 사본을 보관하지 않으므로 백업이 없다면 복구할 수 없어요.'],
    ['어린이', 'Dog-go는 모든 연령이 사용할 수 있으며, 어린이를 포함한 누구의 개인정보도 의도적으로 수집하지 않아요.'],
    ['문의', 'Google Play 스토어 페이지에 안내된 개발자 연락처로 문의해 주세요.'],
  ],
  fi: [
    ['Yhteenveto', 'Dog-go toimii ilman tiliä ja ilman palvelinta. Kaikki luomasi – koirat, kuvat, lenkit, reitit, muistiinpanot ja asetukset – tallennetaan vain laitteellesi. Emme kerää, myy tai jaa henkilötietojasi.'],
    ['Sijainti', 'Luvallasi Dog-go käyttää laitteen GPS:ää vain lenkin tallennuksen aikana reitin piirtämiseen, matkan mittaamiseen sekä kukkien ja löytöjen sijoittamiseen. Androidissa ”Lenkki käynnissä” -ilmoitus pitää seurannan päällä näytön ollessa pimeänä. Sijaintia ei koskaan lähetetä meille tai kolmansille osapuolille. Karttakuvat ladataan OpenStreetMapin palvelimilta, jotka – kuten mikä tahansa verkkosivusto – näkevät IP-osoitteesi ja katsotun kartta-alueen, mutta eivät GPS-sijaintihistoriaasi.'],
    ['Kuvat ja kamera', 'Koiraeditoriin valitsemasi kuvat ja lenkeillä ottamasi kuvat käsitellään ja tallennetaan vain laitteellesi. Ne lähtevät laitteelta vain, jos itse jaat lenkkikortin tai tallennat varmuuskopion.'],
    ['Ilmoitukset', 'Käytetään vain itse asettamaasi päivittäiseen lenkkimuistutukseen ja ”Lenkki käynnissä” -ilmoitukseen. Voit poistaa ne käytöstä asetuksista milloin tahansa.'],
    ['Mainokset', 'Tämä versio näyttää vain testimainoksia; mainos-SDK:ta ei ole mukana eikä mainostunnisteita kerätä. Jos oikeita mainoksia lisätään myöhemmin, päivitämme tämän selosteen ensin ja kerromme, mitä mainoskumppani kerää.'],
    ['Varmuuskopiot ja jakaminen', 'Varmuuskopiot ja lenkkikortit ovat laitteellasi luotuja tiedostoja. Sinä päätät, minne ne menevät (esim. Google Drive tai viestisovellus); näihin sovelletaan kyseisten palvelujen omia tietosuojakäytäntöjä.'],
    ['Tietojen poistaminen', 'Poista yksittäisiä lenkkejä tai koiria sovelluksessa, tai poista Dog-go poistaaksesi kaiken. Koska meillä ei ole kopiota, poisto on lopullinen, ellet ole tallentanut varmuuskopiota.'],
    ['Lapset', 'Dog-go sopii kaikenikäisille, eikä se tietoisesti kerää kenenkään, myöskään lasten, henkilötietoja.'],
    ['Yhteystiedot', 'Kysyttävää? Ota yhteyttä Google Play -kauppasivulla mainittuun kehittäjän yhteystietoon.'],
  ],
};

export default function PrivacyPage() {
  const { t, lang } = useT();
  const router = useRouter();
  return (
    <main className="mx-auto min-h-[100dvh] max-w-md space-y-3 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <button className="btn-secondary px-3 py-2" onClick={() => router.back()} aria-label={t('common.back')}>
          ←
        </button>
        <h1 className="text-2xl font-black">🔒 {t('privacy.title')}</h1>
      </header>
      <p className="text-xs text-bark/60">{t('privacy.updated', { date: UPDATED })}</p>
      {POLICY[lang].map(([title, body]) => (
        <section key={title} className="card space-y-1">
          <h2 className="font-black">{title}</h2>
          <p className="text-sm leading-relaxed text-bark/80">{body}</p>
        </section>
      ))}
    </main>
  );
}
