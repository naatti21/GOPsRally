import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {saveJSON} from './versions.mjs';
const read=p=>JSON.parse(readFileSync(p));
const d=read('lab-results/full/summary.json'),sweep=read('lab-results/sweep/summary.json');
if(existsSync('lab-results/sweep-postpeak/summary.json'))for(const entry of read('lab-results/sweep-postpeak/summary.json').results){
 sweep.results=sweep.results.filter(r=>r.name!==entry.name);sweep.results.push(entry);
}
const cameras=read('lab-results/full/camera-summary.json'),cameraSweep=read('lab-results/full/camera-smoothing-summary.json');
if(cameras.length!==8||new Set(cameras.map(r=>r.physicsTraceSha256)).size!==1)throw Error('Missing/unequal camera comparison');
const f=n=>Number(n).toFixed(2),by=(v,id)=>v.scenarios.find(s=>s.scenario.id===id).summary;
let md=`# Pitkän ajon tutkimustulokset — v0.4.7

**Johtopäätös: NO-GO uudelle ajofysiikan julkaisulle. Tutkimuslaboratorio on tarkastettavissa; yhtään säätöehdokasta ei suositella vielä peliversioksi.**

620 lukittua vertailuajoa (1 550 880 fysiikka-askelta, noin 7,18 tuntia simuloitua ajoa) toistavat ongelman. Vakio-ohjauksen jälkeinen vapautus rauhoittuu, mutta viivästetty vastakäännös voi moninkertaistaa luiston ja kääntymisnopeuden. Pitkässä nappiohjauksessa ongelma näkyy jo tasaisella pinnalla. Maasto ja pidon vaihtelu pahentavat sitä; kamera ei selitä mitattua fyysistä heiluntaa.

Suositus seuraavaksi: säilytä julkaisut ennallaan ja käytä tätä laboratoriota ohjaus–rengas–yaw-vasteen jatkotutkimuksessa sekä oikeiden Android-nappiajoitusten vertailussa. Pelkkä pidon, ohjausnopeuden tai kameran yhden kertoimen säätö ei osoittautunut yleiseksi ratkaisuksi. Testiajurin palaute voi itsessään tuottaa heiluntaa, joten tulos ei yksin todista kaikkien ihmisajajien kokemusta.

## Lukitut versiot ja menetelmä

Katso [koejärjestely, tarkat SHA:t, mittarien määritelmät ja toistokomennot](long-run-handling-investigation.md).
Kaikki alla olevat ajot käyttävät oikeaa Rapieria. Pelin julkaistua ajofysiikkaa, rataa, renderöijää tai PWA:ta ei muutettu.

## Neljän version pitkä vertailu

100 km/h **lähtönopeus**, 150 s jatkuva ajo, 200 ms havaintoviive ja 200 ms nappipäätösjakso. Nopeutta ei pidetä vakiona. Kokonainen kierros lasketaan vain nykyisillä suunnatuilla tarkistuspisteillä. Keskinopeudet ovat olennaisia: samat lähtönopeudet eivät takaa samoja nopeuksia myöhemmissä mutkissa.

| Versio | Pinta | Fyysiset heiluntasyklit | Spinout-jaksot | Pyörä rajan ulkopuolella, s | Keskinopeus km/h | Hyväksytyt kierrokset |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
`;
for(const v of d.results)for(const id of ['oval-flat-100','real-full-100']){const r=by(v,id);md+=`| ${v.version.name} | ${id.startsWith('oval')?'Tasainen vakiosäde':'Todellinen rallimaasto'} | ${r.oscillationCycles} | ${r.spinouts} | ${f(r.offRoadSeconds)} | ${f(r.meanKmh)} | ${r.laps.length} |\n`;}
md+=`
[Kaikkien neljän version aikasarjakuva](metrics/long-run/long-run-comparison.png). Heiluntasyklien määrä ei yksin ole laatupiste: pitkä ulosajo tai spinnaus voi vähentää laskettavia suunnanvaihtoja.

## Ohjauspulssi ja vastakorjaus

100 km/h, ensin RIGHT 650 ms, sitten 300 ms vapautus ja LEFT 300 ms. Taulukon vapautusvertailussa LEFT puuttuu kokonaan. Poikittainen sijainti mitataan 6 sekunnin kohdalla alkuperäisestä suorasta; molemmat autot saavat jatkaa liikkumista vapaasti.

| Versio | Vapautuksen suurin luisto ° | Vastakorjauksen suurin luisto ° | Vastakorjauksen suurin yaw °/s | Vapautuksen sivusiirtymä m | Vastakorjauksen sivusiirtymä m | Korjauksen loppunopeus km/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
`;
for(const v of d.results){const a=by(v,'release-100-0.65'),b=by(v,'catch-100-0.65-0.3-0.3');md+=`| ${v.version.name} | ${f(a.peakSlip)} | ${f(b.peakSlip)} | ${f(b.peakYaw)} | ${f(a.finalX)} | ${f(b.finalX)} | ${f(b.exitKmh)} |\n`;}
md+=`
Korjaus voi pienentää lopullista poikkeamaa mutta samalla kääntää sen vastakkaiselle puolelle, kasvattaa yaw-nopeutta ja hidastaa autoa. Siksi pieni loppuluisto tai suuri huippuluisto yksin ei osoita hallittavuutta. [Ohjaus, luisto, yaw ja kuljettu sivupolku](metrics/long-run/delayed-countersteer.png).

v0.4.6:n luiston huippu eri reagointi- ja painallusajoilla samasta 100 km/h / 650 ms sisäänmenosta:

| Vastakorjauksen viive | LEFT 200 ms | LEFT 300 ms | LEFT 400 ms |
| --- | ---: | ---: | ---: |
`;
const last=d.results.find(v=>v.version.name==='v046');
for(const delay of [.1,.2,.3,.45])md+=`| ${delay.toFixed(2)} s | ${[.2,.3,.4].map(hold=>{const r=by(last,`catch-100-0.65-${delay}-${hold}`);return `${f(r.peakSlip)}°${r.spinouts?' (spinout)':''}`;}).join(' | ')} |\n`;
md+=`
**200–400 ms painallukset eivät muodosta tasaista anteeksiantavaa ikkunaa:** 200 ms korjaus on tässä kokeessa maltillinen, 300 ms tuottaa 31–46° ja 400 ms jopa spinout-jakson. Tämä on painalluksen keston herkkyyttä, ei vain reaktioajan ongelma. 70 ja 126 km/h sekä lyhyet/pitkät sisäänmenot ovat mukana koko numeerisessa aineistossa; johtopäätöstä ei rakenneta ainoan 100 ms onnistumisen varaan.

## Maaston ja pinnan erottelu

v0.4.6, sama 100 km/h lähtö ja 150 s ajuri:

| Koe | Spinout-jaksot | Pyörä rajan ulkopuolella, s | Heiluntasyklit |
| --- | ---: | ---: | ---: |
`;
for(const id of ['oval-flat-100','oval-low-100','oval-transition-100','oval-banked-100','oval-uneven-100','real-full-100','real-uniform-100','real-flat-100']){const r=by(last,id);md+=`| ${id} | ${r.spinouts} | ${f(r.offRoadSeconds)} | ${r.oscillationCycles} |\n`;}
md+=`
Tasaisen radan ongelma sulkee pois väitteen, että heilunta vaatisi töyssyjä. Todellisen radan tasainen pitoluokitus vähentää ulosajoa mutta ei poista ongelmaa. Korkeuserojen poistaminen ei myöskään korjaa sitä. Nämä ovat fyysisen järjestelmän ja saman ajurin vuorovaikutuskokeita: ajolinjan muutokset vaikuttavat myöhempiin nopeuksiin ja kontakteihin. Yhden tietyn töyssyn kausaalista osuutta ei voi päätellä pelkistä kokonaisluvuista.

[Pyörien kuormat, jousituksen liike, pitch ja roll](metrics/long-run/loads-and-body.png). Yksikään vertailuajo ei poistunut törmäysmeshin alueelta; ulosajoja ei siivottu resetillä. Vakio-ohjaus 15 s ja sitä seuraava 135 s vapautus eivät tuottaneet itsestään jatkuvaa suunnanvaihtoheiluntaa näillä lähtönopeuksilla. Tämä tukee syötteen vaihtumisen/palautesilmukan merkitystä, ei todista kaikkia rengastiloja stabiileiksi.

## Kamera samasta fysiikasta

Kaikille seuraaville näytetään täsmälleen sama 9 000 askeleen v0.4.6-maastoajo. Rungon heading-nopeuden RMS on ${f(cameras[0].bodyHeadingRateRms)}°/s.

| Renderöijä | Kamera | Kameran heading-nopeuden RMS °/s | Auton keskipiste näkymän ulkopuolella, ruutua |
| --- | --- | ---: | ---: |
`;
for(const r of [...cameras,...cameraSweep])md+=`| ${r.version} | ${r.mode} | ${f(r.cameraYawRateRms)} | ${r.carOutsideNdcFrames} |\n`;
md+=`
[Identtisen fysiikan kameravertailu](metrics/long-run/camera-replay.png). 90 → 200 ms heading-suodatus vähentää Chase-liikettä vain vähän. Se ei muuta rungon liikettä lainkaan. Kamera voi silti vaikuttaa ihmisen havaintoihin ja painalluksiin; sitä ei tässä offline-toistossa mitata. Keskipisteen näkyvyys ei yksin takaa koko auton, tien tai HUDin hyvää näkyvyyttä. Android-ruudunpäivitys ja kosketusviive ovat **NOT MEASURED**.

## Rajattu yhden parametriperheen seulonta

Kaikki muutokset tehtiin väliaikaisiin v0.4.6-lähdearkistoihin vasta lähtövertailun jälkeen. Alla kaksi 150 s testiä; muut 6 s korjauskokeet ja tarkat muutokset/hajautukset ovat [seulonta-aineistossa](metrics/long-run/sweep-summary.json).

| Muutos | Tasaisen radan spinoutit / ulkona s | Oikean radan spinoutit / ulkona s |
| --- | ---: | ---: |
`;
for(const v of sweep.results){const a=v.runs.find(r=>r.scenario.id==='oval-flat').summary,b=v.runs.find(r=>r.scenario.id==='real-full').summary;md+=`| ${v.name} | ${a.spinouts} / ${f(a.offRoadSeconds)} | ${b.spinouts} / ${f(b.offRoadSeconds)} |\n`;}
md+=`
Yksikään seulottu perhe ei poista pitkän ajon ongelmaa molemmissa ympäristöissä. Esimerkiksi ohjausauktoriteetin pienennys auttaa lyhyttä vastakorjausta mutta heikentää tasaista pitkää ajoa. Kaasun voimakkaampi rajoitus mutkassa vähentää maastokokeen spinouteja mutta huonontaa tasaista ajoa. Näistä ei yhdistelty näennäistä voittajaa eikä optimoitu lyhintä testikierrosta. **Suositeltuja julkaisukandidaatteja: 0.** Seulonta on rajallinen eikä todista, ettei parempaa yhdistelmää olisi olemassa.

## Todistettu, todennäköinen ja vielä avoin

- **Todistettu:** samat digitaalitulot tuottavat uusissa versioissa selvästi suuremman vastakorjauksen yaw- ja luistovasteen. Tähän ei tarvita kameraa, maastoa, huonoa renderöintinopeutta tai v0.4.6:n lisätehoa: ilmiö näkyy jo v0.4.5:ssä.
- **Todistettu:** lyhyen pulssin vapautuksen jälkeen auto voi rauhoittua, vaikka toistuva viivästetty ohjaus tuottaa pitkään jatkuvaa vuorottelua. Näin lyhyt onnistuva drift-testi voi jäädä harhaanjohtavaksi käyttöliittymän hallittavuuden mittariksi.
- **Todennäköinen mekanismi:** fyysisen rengas-/yaw-vasteen suuri vahvistus ja muistivaikutus yhdessä digitaalisen vastakäännöksen keston sekä kuljettajan havaintoviiveen kanssa. Kuormansiirto ja jaettu pitkittäis-/sivuttaispitobudjetti muuttavat vastetta edelleen. Pelkkää yhtä rengaskerrointa ei eristetty ainoaksi juurisyyksi.
- **Avoin:** kuinka suuri osa Android-palautteesta johtuu ihmisohjauksen ajoituksesta, kosketuslatenssista, frame pacingista tai Chase-näkymän palautteesta. Uusi ajuri on tarkoituksella yksinkertainen eikä edusta opetettua ihmiskuljettajaa. Kaikkien parametrien systemaattista optimointia ei tehty.
- **Avoin:** täysin nopeus- ja ratapistekohtaisesti paritettu paikallinen dynamiikka maastossa. Samasta lähtötilasta jatkuva auto saa tarkoituksella kulkea eri polkua; sitä ei pakoteta samaan tilaan seuraavassa mutkassa.

## Validointi ja toimitusrajat

Koko Node-/selaintestien lopulliset tulokset kirjataan toimituksen validointiosaan. Simulaation suorittuminen ei tarkoita, että ajo olisi onnistunut: yllä näkyvät spinoutit, ulosajot ja puuttuvat kierrokset ovat todellisia epäonnistuneita ajotuloksia. Niitä ei muutettu ohitetuiksi turvallisuustesteiksi.

Yksi laboratoriotyökalun polkuvirhe korjattiin: Playwright tyhjensi ensimmäiset test-results-hakemiston raakatallenteet. Koko 620 ajon sarja ajettiin uudelleen erilliseen lab-results-hakemistoon; julkaistut numerot perustuvat siihen. Kameratoiston ensimmäinen paikallinen palvelureitti palautti 404:n; se korjattiin oikeaksi Viten HTML-sisäänmenoksi. Kumpaakaan epäonnistumista ei esitetä onnistuneena mittauksena.

Ei mergeä, deployta, tuotantomuutoksia, leaderboard-muutoksia tai testirajojen löysennystä. Seuraava päätös kuuluu riippumattomaan tarkastukseen ja Android-testisuunnitelmaan.
`;
md+='\nLopulliset paikalliset testitulokset ja suorittamatta jääneet tarkistukset: [validointikirjaus](long-run-validation.md).\n';
writeFileSync('docs/long-run-handling-results.md',md);
saveJSON('docs/metrics/long-run/sweep-summary.json',sweep);
saveJSON('docs/metrics/long-run/camera-smoothing-summary.json',cameraSweep);
