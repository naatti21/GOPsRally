# Digital C1 — Android-testiohje (ei julkaistu)

**Tila 26.10.2026: NO-GO.** Pitkän ajon ja driftin aloituksen tunnetut ongelmat
on kuvattu [mittausraportissa](digital-handling-c1-report.md). Tämä ohje ei ole
julkaisulupa eikä pyyntö käyttää aikaa valmiiksi huonoksi tiedettyyn hyväksyntätestiin.
C1:tä ei ole asennettu julkiselle pelisivulle. Älä korvaa v0.4.4–WGT-vertailuja.

## Kehittäjän valmistelu paikalliseen diagnostiikkaan

1. Checkout testattava PR-SHA ja kirjaa se. Fysiikkakoodi tässä raportissa:
   `e4978c53338b58ef7a9eaefeb295b97c296db24c`.
2. `npm ci`, `npm run build`, `npm run preview`. Build ei julkaise mitään.
   Tarkista paikallinen polku `/GOPsRally/v04/` ja otsikko **DIGITAL C1 · EXPERIMENT / NO-GO**.
3. Android USB debugging + tietokoneen ADB: `adb reverse tcp:4175 tcp:4175`.
   Avaa puhelimen Chromessa `http://127.0.0.1:4175/GOPsRally/v04/`.
   Käytä paikallista alkuperää, älä julkaistun pelin PWA-asennusta.
4. Kirjaa puhelin, Android/Chrome-versio, näytön virkistystaajuus, pysty/vaaka,
   kamera, ajosuunta ja aloituspaikka. Aloita Fixed-kamerasta. Älä vaihda asetuksia
   vertailuparin välissä. Aiemmat versiot palvellaan erillisistä worktreeistä
   ja eri localhost-porteista, jotta välimuistit eivät sekoitu.
5. Varmista WebGL2, näkyvät napit ja ettei konsolissa ole virheitä.
   Työympäristön WebGL-este ei ollut Androidilla todettu vika.

## Mittaus: oikea nopeus ja todelliset painallukset

HUD:n **ground km/h** on vaakatasoisen nopeusvektorin pituus. Se ei ole vanhan
HUD:n eteenpäin projektio eikä WGT:n pyöränopeus. SLIP on korin suunnan ja todellisen
liikesuunnan ero. Nopeus voi säilyä suurena auton liikkuessa kylki edellä.

Chrome remote DevTools antaa `rallyDrive.snapshot()`-havainnon: `groundSpeedMps`,
`speed` (eteenpäin), `lateralSpeed`, `truePlanarSlipAngle`, `yawRate`, `rackAngle`,
`steeringControl`, `input`, pyöräkohtaiset pinnat/kuormat, lap ja ruutuaikamittarit.
Kulmat ovat radiaaneina; kerro 180/π. Nämä havainnot eivät muuta fysiikkaa.

Puhelimen DevTools-konsoliin voi ajaa tämän paikallisen, enintään 3 min keruun.
Se tallentaa havaittuja DOM-painalluksia ja render-havaintoja; ei kosketusanturin
raakatietoa eikä koko päästä päähän -viivettä. Näytön nauhoitus on lisänäyttöä,
ei millisekuntitarkka painallusmittaus.

```js
(() => {
  const log = {started: new Date().toISOString(), samples: [], events: []};
  const start = performance.now();
  let stopped = false;
  const onPointer = e => {
    const button = e.target.closest?.('[data-drive]');
    if (button) log.events.push({t: performance.now()-start, type: e.type,
      id: e.pointerId, button: button.dataset.drive});
  };
  const types = ['pointerdown','pointerup','pointercancel','lostpointercapture'];
  types.forEach(t => document.addEventListener(t,onPointer,true));
  function sample() {
    if (stopped) return;
    const s = rallyDrive.snapshot();
    log.samples.push({t:performance.now()-start, input:s.input,
      groundKmh:s.groundSpeedMps*3.6, forwardKmh:s.speed*3.6,
      lateralKmh:s.lateralSpeed*3.6, slipDeg:s.truePlanarSlipAngle*180/Math.PI,
      yawDeg:s.yawRate*180/Math.PI, rack:s.rackAngle, control:s.steeringControl,
      position:s.position, wheels:s.wheels, lap:s.lap, metrics:s.metrics});
    if(performance.now()-start < 180000) requestAnimationFrame(sample);
    else stop();
  }
  function stop() {
    if(stopped) return;
    stopped=true;
    types.forEach(t=>document.removeEventListener(t,onPointer,true));
    const u=URL.createObjectURL(new Blob([JSON.stringify(log)],{type:'application/json'}));
    const a=document.createElement('a');a.href=u;a.download='digital-c1-android.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
  }
  window.stopC1Capture=stop;
  requestAnimationFrame(sample);
})();
```

Keruun voi päättää komennolla `stopC1Capture()`. JSON jää omalle laitteelle.
Kirjaa tarkka SHA tiedoston rinnalle. Jos tauotat sovelluksen tai käyttöjärjestelmä
keskeyttää kosketuksen, merkitse se; älä tulkitse sitä samaksi kuin vapaaehtoinen vapautus.

## Rajattu ajosuunnitelma myöhempää hyväksyttyä testiä varten

| Koe | Suoritus | Mitä kirjataan |
| --- | --- | --- |
| Lähtö | 3 automaattikaasukiihdytystä suoralla | Todellinen 0–40/0–80, koettu vaste, ruutuajat |
| Luiston aloitus | 70/100/126 km/h **mitattu** sisäänmeno; ohjaus noin 350/650/1200/1800 ms | Todellinen pitoaika, luiston kasvu, paljonko ajolinja muuttuu |
| Vastakorjaus | Sama sisäänmeno; vapautus ja 200/300/400/450 ms vastanappi, 3 yritystä | Luisto/yaw ennen, aikana ja jälkeen; uusi vastakkainen luisto; nopeus |
| Vapautus | Sama mutka ilman vastanappia | Palautuuko auto, meneekö haluttuun suuntaan vai pelkästään suoristuu |
| Ajolinja | Ennen mutkaa jarrutus, wide→apex→exit, sitten liian aikainen ja myöhäinen apex | Radalla pysyminen, korjausten määrä, ulostulonopeus ja virheen seuraukset |
| Pinta | Sora, piennar, ruoho ja takaisin tiehen | Todelliset pyöräpinnat/kuormat, pidon palaaminen ja suunnanvaihdot |
| Pitkä ajo | 3 min ilman resettiä, vähintään kaksi suuntaa vaihtavaa mutkaa | Pystyykö suunnittelemaan linjaa vai meneekö huomio jatkuvaan pelastamiseen |
| Kamera | Yksi vastaava ajo Chase-kameralla | Erottele näkyvyys/tuntuma fyysisestä luistosta ja yaw'sta |

Pidä lähtönopeuden poikkeama näkyvissä; ihmisen 70/100/126 ei ole täsmälleen
simulaation lähtötilan asetus. Älä sovita jälkikäteen huonoja yrityksiä pois.
Reset on sallittu eri yritysten välissä mutta mitätöi kyseisen pitkän ajon palautumisnäytön.
Tahallinen ylivauhti ja pitkä väärä ohjaus saavat epäonnistua; tavallinen 200–450 ms
korjaus ei saa arvaamattomasti aloittaa uutta 60–90° luistoa.

## Hyväksynnän portti

Lyhyen kiinnioton, ohjauksella aloitettavan driftin, ennakoivan jarrutuksen ja
pitkän ajolinjan hallinnan pitää toteutua **samassa versiossa**. Hyvältä tuntuva
30 s pätkä tai vihreä CI ei riitä. Tämän C1:n pitkäajon hylkäys pysyy voimassa,
vaikka jokin puhelinkoe tuntuisi paremmalta. Merge ja mahdollinen uusi erillinen
julkaisu vaativat käyttäjän uuden hyväksynnän.
