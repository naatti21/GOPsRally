# Digital C1 — integroitu arcade-ohjaus, mittausraportti

**26.10.2026 · NO-GO: ei yhdistämistä eikä peliversion julkaisua.**

Korjausehdokas parantaa 200–450 ms vastakorjauksia ja tavallista 150 sekunnin ajoa,
mutta ei täytä koko tavoitetta. Pitkä ajo pelkällä ennakoivalla jarrutuksella epäonnistuu,
lyhyt luiston aloitus laimenee liikaa ja kuusi vanhaa fysiikkatestiä rikkoutuu.
Tämä on toteuttajan tutkimus ja hylätty kehitysehdokas, ei riippumaton QA-hyväksyntä.

Testattu sovelluskoodi: `e4978c53338b58ef7a9eaefeb295b97c296db24c`.
Paikallisesti testattu commit `3087a64a5d37e535d6ecb93b7a8b6747c1d420b4` ja GitHubin yllä oleva commit
sisältävät saman Git-puun `aed2b0e7bbbc3bc1d9c27b5598d9b1e0178648f9`;
GitHub-connectorin tekijä-/aikaleimametadata vaihtoi commit-SHA:n, ei tiedostoja.
Raportin jälkeen mahdollisesti muuttuvat dokumentit eivät muuta tätä koodia.

## 1. Lähtötieto ja rajaus

Luettu repon AGENTS.md, issue #1, fysiikkabriefi, Playbook 1.9.2, PR #18:n tutkimus
sekä Android-kommentit [6397071074](https://github.com/naatti21/GOPsRally/pull/18#issuecomment-6397071074),
[6403788801](https://github.com/naatti21/GOPsRally/pull/18#issuecomment-6403788801) ja
[6411687356](https://github.com/naatti21/GOPsRally/pull/18#issuecomment-6411687356).
Viimeisen palautteen tarkkaa Android-buildia ei ole nimetty; sitä ei päätellä.

PR pinoutuu tutkimushaaran `feature/v047-handling-investigation` päälle:
`c4d8c5b6d4fe864d7dc604fb75e1b737dd1fda9c`. Näin uusi diffi erottaa tämän kokeen
PR #18:n jo olemassa olevasta laboratoriosta. AGENTS.md:n alkuperäinen v0.4-aloitushaara
on historian taustalla, ei tämän uudemman tutkimuksen ajantasainen vertailupohja.
Yhtäkään aiempaa haaraa, julkaisuhakemistoa tai kameraa ei muutettu.

| Vertailu | Lukittu lähdecommit |
| --- | --- |
| v0.4.4 | `ca746502855fddbac7a99101ff400437d672c78a` |
| v0.4.5 | `9cc39de4c6616a82a69081fc83c0a0d656a4265f` |
| v0.4.5b | `bac49764e38f3fd220b3af67a08035af5463836d` |
| v0.4.6 | `bd5b3222c6d18014048dbc65d09c2566fa6446ed` |
| v0.4.6WGT | `8ce83a859740c76769769a6309ffbaa34b30c739` |
| Digital C1 | `e4978c53338b58ef7a9eaefeb295b97c296db24c` |

WGT:n julkaisuworkflow commitissa `e09b54b1777bb52da548c87e5115e8331627b744`
checkouttaa nimenomaan yllä olevan lähde-SHA:n. WGT:n tiepito ja tieohjaus ovat
v0.4.6:n mukaisia; ruoho on 0.58 aiemman 0.43:n sijasta ja ruohon moottoripyynnöllä
on 0.42:n kitkabudjettiraja. Pyöränopeusmittaus on erillinen havaintomalli.
C1 perustuu v0.4.6:een eikä sisällä WGT:n ruoho- tai pyöränopeusmuutoksia.
WGT:n ja C1:n maastoero ei siksi ole yhden muuttujan koe; puhdas ohjausvertailu on v0.4.6–C1.

## 2. Miksi 200–400 ms tekee niin suuren eron?

v0.4.6 antaa digitaaliselle napille lähes täyden, nopeusriippuvaisen etupyöräkulman.
100 km/h kohdalla peruskulma on noin 0.35 rad eli 20 astetta. Rackin aikavakio on
70 ms; rengastilan relaksaatiopituus 0.8 m vastaa tässä nopeudessa noin 29 ms:ia.
Pidempi painallus siis pitää eturenkaat jo täysin toimivassa vastakäännössä, ei vain
nosta hitaasti ohjausta. Yhteinen pitkittäis-/sivuttaisvoiman kitkaympyrä ja
eturenkaiden/takarenkaiden eri kontaktinopeudet määräävät seuraavan yaw-momentin.

Mitattu v0.4.6, RIGHT 650 ms, vapautus 300 ms, LEFT 400 ms:

| Aika alusta | Todellinen luisto ° | Yaw °/s | Rack rad | Etuakselin sivuvoima N | Taka-akselin sivuvoima N |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0.95 s, vastakorjaus alkaa | -11.57 | -17.33 | 0.005 | 4118 | 6204 |
| 1.15 s, korjausta 200 ms | -7.44 | 49.20 | -0.345 | -4218 | 5612 |
| 1.25 s, korjausta 300 ms | -0.71 | 81.71 | -0.342 | -4844 | 0 |
| 1.35 s, korjausta 400 ms | 6.50 | 86.11 | -0.338 | -4980 | -5045 |
| 1.65 s, nappi jo vapautettu | 24.91 | 71.80 | -0.005 | -4627 | -6218 |

Voimat ovat pyörien omien sivuakselien summia, eivät suoraan maailman x-voimia.
Kontaktivoimat on näytteistetty ennen integraatiota ja asento sen jälkeen (yksi 60 Hz askel).
Positiivinen yaw tarkoittaa vasemmalle kiertymistä; positiivinen rack oikealle ohjausta.

**Ratkaiseva havainto:** 300 ms kohdalla alkuperäinen sivuluisu on lähes nolla,
mutta kori pyörii jo noin 82°/s vastakkaiseen suuntaan. Jatkuva vastakääntö kasvattaa
uuden luiston. Nappia vapautettaessa liikemäärä ei katoa. Pelkkä luistokulma tai
0.1 sekunnin kiinniottotesti jättää tämän vaiheen näkemättä. Tämä on fyysisen
järjestelmän ja digitaalisen syötteen yhteisvaikutus, ei kamerasta laskettu vaikutelma.

## 3. Yksi integroitu ehdokas

`digital-steering.js` yhdistää kolme osaa yhdessä ohjausnivelen ohjaimessa:

1. Lyhyt yhtäjaksoinen painallus käyttää 45 % perusohjauspyynnöstä. 300 ms jälkeen
   jatkuva painallus kasvattaa pyynnön tasaisesti 125 %:iin seuraavan 800 ms aikana.
   Vapautus tai suunnanvaihto nollaa tämän painallushistorian.
2. Todellinen sivunopeus ja yaw-nopeus muuttavat ohjauspyyntöä:
   `feedback = clamp(0.7 * beta + 0.22 s * yaw, -0.4, 0.4)` rad.
   Tämä on avoimesti ilmoitettu ohjausavustus, myös napin vapautuksen aikana.
   Sitä ei kutsuta pelkäksi luonnolliseksi rengasfysiikaksi.
3. Kokonaispyyntö rajataan ±0.64 radiin ja toteutetaan alkuperäisen 70 ms rackin kautta.
   Peruskulman nopeus käyttää sivuttaisliikkeen sisältävää nopeutta. Hidas ajo ja
   peruutus säilyttävät suoran ohjauksen; avustus häipyy eteenpäin nopeudella 3–12 m/s.

Renkaiden kitkaa, kitkaympyrää, jousitusta, moottoria, kameraa tai rataa ei nosteta
keinotekoisesti. Kaikki rungon kääntyminen syntyy edelleen kuormitetun renkaan
kontaktivoimasta; ei suoraa yaw-voimaa, pose-kirjoitusta, radan suuntaan vetoa tai resettiä.
Automaattikaasu ja alkuperäinen cornerDriveManagement säilyvät.

HUD näyttää tässä kokeessa **ground km/h** ja oikean vaakatasoisen luistokulman
(-180…180°). Eteenpäin projisoitua nopeutta ei esitetä kokonaisnopeutena.
Fysiikkatunniste `rapier-digital-c1-unreleased` estää vertailua vanhan mallin kierrosaikoihin.

Alustavassa rajatussa seulonnassa vahva vakioavustus vaimensi liikaa luiston aloitusta;
heikompi yaw-palaute rauhoitti lyhyen pulssin mutta tuotti 13 spinoutia oikean radan
150 s ajossa. Näitä ei säilytetty vaihtoehtoisina julkaisuina. C1 on ainoa PR:n ehdokas.
Seulonta on kehitystyötä, ei erillinen vahvistusaineisto.

## 4. Menetelmä ja todistusaineisto

Päämatriisi: **6 mallia × 243 tapausta = 1 458 ajoa, 3 365 280 askelta**,
noin 15.58 tuntia simuloitua ajoa. Node 24.22.1, lukitut Rapier 0.21.0 / Three 0.186.1.
60 Hz kiinteä askel; saman version C1-matriisi toistettiin kokonaan ja kaikkien
243 tapauksen kaikki fyysiset yhteenvetomittarit olivat täsmälleen samat.
Trace-tiedostojen hashit erosivat lisätyn read-only-telemetrian vuoksi; tätä ei lasketa fysiikkaeroksi.

- Lähtönopeudet 70 / 100 / 126 km/h; nopeus kehittyy tämän jälkeen vapaasti.
- Sisäänmeno-ohjaus 350 / 650 / 1 800 ms; vastakorjauksen viive 100 / 200 / 300 / 450 ms;
  painallus 200 / 300 / 400 / 450 ms; erilliset pelkät vapautukset.
- Kompakti tie, irtonainen sora, piennar, ruoho; tasainen ovali, pitovaihdos, kallistus,
  epätasaisuudet, alkuperäinen mäkinen rata, tasapitoinen ja tasoitettu rataversio.
- 150 s ajot, 180 s ennakoivan jarrutuksen kokeet, 600 s yhtäjaksoiset ajolinjakokeet.
  Ajurin päätösväliä myös 300/400 ms; havaintoviivettä 100/300/450 ms.
- Vain LEFT / RIGHT / BRAKE. Ei fysiikan tilan kirjoittamista lähdön jälkeen.
  Initissä yksi spawn, 2 s **jarrutettu** asettuminen, lähtönopeuden asetus.
  `enabled=false` ei ole neutraali rullaus.
- Pitkän ajon ajuri käyttää viivästettyä auton havaintoa ja tarkkaa karttatietoa.
  Se ei mallinna ihmisen oppimista, Androidin viivettä eikä subjektiivista tuntumaa.
- Ennakoivan jarrutuksen ajuri estää nopeussuunnitelman jarrutuksen mutkan sisällä,
  mutta sallii erikseen kirjatun ulosajojarrutuksen. Se ei ole optimoitu jokaiselle autolle.

Päämittarit lasketaan maailman nopeusvektorista ja korin headingistä:
luisto, yaw, avoimen kokeen palautumisaika, pyöräkeskusten rajanylityssekunnit,
spinoutit (>60° vähintään 0.25 s nopeudella >5 m/s), palautumiset ja suunnatut
checkpoint-kierrokset. Pyöräkeskus ei ole renkaan koko kosketusala.
Kierros ei tarkoita puhdasta kierrosta; ulosajot raportoidaan erikseen.
Avoimen kentän sivupoikkeama ei ole epäonnistunut ratakierros.

Tiedostot: [kaikki tulokset CSV](metrics/digital-c1/results.csv),
[täysi pakattu yhteenveto](metrics/digital-c1/summary.json.gz),
[tarkisteet](metrics/digital-c1/manifest.json),
[mutka- ja kiihtyvyysvertailu](metrics/digital-c1/corners-and-acceleration.json),
[saman sisäänmenon koe](metrics/digital-c1/matched-entry.json.gz).
Raakoja 60 Hz traceja ei lisätä Git-historiaan: skriptit tuottavat ne uudelleen.

## 5. Lyhyet vastakorjaukset: parannus ja tärkeä varaus

100 km/h, RIGHT 650 ms, vapautus 300 ms. Taulukossa koko 6 s kokeen huippuluisto:

| Malli | LEFT 200 ms | LEFT 300 ms | LEFT 400 ms | LEFT 450 ms |
| --- | ---: | ---: | ---: | ---: |
| v0.4.4 | 0.68° | 0.68° | 0.68° | 0.68° |
| v0.4.5 | 12.62° | 38.37° | 58.07° | 61.75° |
| v0.4.5b | 12.42° | 40.19° | 58.08° | 60.86° |
| v0.4.6 / WGT | 12.58° | 41.70° | 60.47° | 63.06° |
| C1, koko ajo uudella ohjauksella | 3.52° | 3.52° | 3.62° | 3.63° |

C1:n kaikkien kompaktin pinnan vastakorjaustapausten huippu jäi 7.01°:een.
**Tämä ei yksin todista kiinnioton paranemista:** C1 aloittaa myös pienemmän luiston.
Siksi tehtiin vielä 72 parikoetta (144 simulaatiota), joissa v0.4.6 ajaa molempien
sisäänmenon identtisesti ja vain ohjain vaihdetaan vastakorjauksen alussa.
Kaikkien sisäänmenoaskelten asento, nopeus, yaw, luisto ja rack todettiin täsmälleen samoiksi.
Runkoon ei kirjoiteta tilaa eikä renkaita/jousitusta alusteta uudelleen.

Saman sisäänmenon 100 km/h / 650+300 ms kokeessa ohjaimen vaihto tuotti kaikilla
200/300/400/450 ms korjauksilla 11.585° huippuluiston. Yaw-huippu 400 ms tapauksessa
pieneni **86.71 → 56.24°/s**, spinout 1 → 0. Kaikkien 72 hybriditapauksen huippuluisto
oli enintään 13.66° eikä spinouteja syntynyt. Tämä tukee ohjausavun kiinniottovaikutusta,
mutta hybridi on kausaalinen diagnostiikka — ei tavallinen C1-ajokerta eikä pitkäajon hyväksyntä.

C1:n tavallisen 300/400 ms kokeen palautumisikkuna alkaa noin 0.35 s painalluksen
päättymisestä (|luisto|<5°, |yaw|<10°/s yhtäjaksoisesti 1 s). Mallissa on pieniä
vaimenevia suunnanvaihtoja; “ei suuria heiluntasyklejä” ei tarkoita täydellistä monotonisuutta.

## 6. Pitkä ajo estää hyväksynnän

100 km/h lähtö, 150 s, sama viivästetty ajuri, jarrutus sallitaan nopeussuunnitelman mukaan:

| Malli / rata | Spinoutit | Pyörä rajan ulkopuolella s | Keskinopeus km/h | Checkpoint-kierrokset |
| --- | ---: | ---: | ---: | ---: |
| v0.4.4 / oikea rata | 0 | 1.32 | 41.96 | 0 |
| v0.4.5 / oikea rata | 12 | 36.00 | 36.02 | 0 |
| v0.4.5b / oikea rata | 9 | 49.28 | 37.47 | 0 |
| v0.4.6 / oikea rata | 12 | 53.27 | 35.03 | 0 |
| WGT / oikea rata | 14 | 47.03 | 35.06 | 0 |
| C1 / oikea rata | 0 | 1.62 | 70.74 | 1 |
| v0.4.6 / tasainen ovali | 2 | 2.43 | 36.46 | 1 |
| C1 / tasainen ovali | 0 | 0.00 | 85.05 | 2 |

C1:n oikean radan 70 km/h koe: 0 spinoutia, 0.13 s rajanylitystä, yksi kierros.
126 km/h koe: **1 spinout, 8.07 s rajanylitystä, huippuluisto 124.13°**, yksi kierros.
Nopeudet ovat lähtönopeuksia, eivät vakionopeuksia tai tavoitteen saavuttamisen todistus.

**Ennakoiva jarrutus, sama oikea rata, 180 s, 100 km/h lähtö:**

| Malli | Spinoutit | Rajanylitys s | Keskinopeus km/h | Kierrokset |
| --- | ---: | ---: | ---: | ---: |
| v0.4.4 | 0 | 0.60 | 44.69 | 1 |
| v0.4.6 | 12 | 78.30 | 33.37 | 0 |
| WGT | 16 | 67.52 | 34.12 | 0 |
| C1 | 6 | **106.25** | 54.39 | 0 |

Spinout-lukumäärä pienenee, mutta radalla pysyminen huononee. Tämä on selvä hylkäys.
600 s keskiviiva-ajossa C1 on pyöräkeskuksen mukaan ulkona **526.25 s**,
WGT 229.02 s ja v0.4.6 222.55 s. C1:n keskinopeus putoaa 17.08 km/h:iin.
C1:n heiluntasyklejä on 26 vs v0.4.6:n 152: tätä ei saa laskea onnistumiseksi,
koska C1 jää pitkäksi aikaa ulos/menettää etenemisen. Ilmiön tarkkaa ensimmäistä
kausaalista kontaktia ei ole vielä eristetty; koko virhettä ei voi nimetä pelkäksi
pidon tai yksittäisen töyssyn ongelmaksi.

## 7. Luiston aloitus, ajolinja ja kiihtyvyys

C1 tekee 100 km/h / 1.8 s ohjauspidolla 6.89° luiston ja viettää 0.67 s
6–18° alueella. Ohjauksella aloitettu luisto siis säilyy rajallisesti.
650 ms pidolla huippu on vain 3.52° vs v0.4.6:n 11.58°: aiempi
lyhyellä ohjauksella aloitettava drift ei säily. Tätä ei kuitata pelkällä
“luisto on mahdollinen” -väitteellä eikä vanhoja testirajoja alenneta.

600 s ennakoivan jarrutuksen ajolinjoissa vain ajurin tavoitepolkua siirretään:

| Malli | -3 m: rajanylitys s / kierrokset | 0 m | +3 m |
| --- | --- | --- | --- |
| v0.4.4 | 32.40 / 4 | 1.35 / 3 | 83.23 / 4 |
| v0.4.6 | 298.77 / 1 | 222.55 / 1 | 292.83 / 0 |
| WGT | 267.55 / 1 | 229.02 / 0 | 291.27 / 1 |
| C1 | 586.08 / 0 | 526.25 / 0 | 419.00 / 0 |

Ajolinja vaikuttaa lopputulokseen, mutta C1:lle ei ole tässä onnistunutta pitkää
ajolinjaa. Vakiosiirrot eivät ole optimoitu wide→apex→exit-rata.
Siksi ajettiin lisäksi aiempi oikean 90° mutkan viiden ajolinjan benchmark muuttamatta
sen ajuria: C1:n sisälinja 9.13 s, late-apex 9.25 s ovat pyörärajan mukaan hyväksyttyjä;
v0.4.6/WGT late-apex 9.45 s. Tämä on paikallinen mutkatulos, ei näyttö pitkästä ajettavuudesta.
Benchmarkin lisäkenttien exitKmh ja maxBodySlipDegrees ovat vanhan oracle-koodin
eteenpäin projisoitu nopeus / säännöllistetty luisto; niitä ei käytetä pääraportin
kokonaisnopeus- tai todellisen 180° luiston mittareina.

0–100 km/h suoralla: v0.4.4/0.4.5/0.4.5b **7.267 s**, v0.4.6/WGT/C1 **4.617 s**.
C1 ei heikennä eikä paranna alkuperäistä suoraa kiihtyvyyttä. Tämä ei ratkaise
Android-palautteen koettua lähtölaiskuutta; tarkka palautteen build ja laiteviive puuttuvat.

## 8. Testit ja rajat

| Tarkistus | Tulos |
| --- | --- |
| PR #18:n alkuperäinen `npm test` samalla ympäristöllä | 63/63 Node + legacy smoke PASS |
| C1 `npm test` | **61/67 PASS, 6 FAIL**; ketju pysähtyy ennen legacy smokea |
| C1 erikseen `npm run test:baseline` | PASS |
| C1 `npm run build` | PASS; bundlen kokovaroitus |
| Uudet controller-/matriisitestit | 4/4 PASS; eivät korvaa vanhoja epäonnistumisia |
| 243 C1-ajon tarkka uusinta | PASS, samat kaikki fyysiset yhteenvedot |
| 72 identtisen sisäänmenon paria | PASS identtisyydelle; kiinniotto paranee |
| Playwright | **BLOCKED**: oletus-Chromium puuttui; saatavilla oleva Chromium 153 käynnistyi mutta WebGL2-konteksti epäonnistui kaikissa 6 tapauksessa. Pinned Chromium 156:n lataus epäonnistui. Ei selain-PASSia. |
| Oikea Android / kosketusviive / FPS | **NOT RUN** |
| Riippumaton hyväksyntä | NOT RUN |

Kuusi vanhaa epäonnistumista: steering-only moderate slide; large steering pulses /
prolonged overcorrection; front-wheel reversal during drift; moderate steer-only slide;
small steer pulse; acceleration/right-left displacement. Viimeinen vaatii >3 m
sivuttaissiirtymän sekunnin ohjauksella; epäonnistuminen ei yksin osoita peilattua
suuntaa, mutta kertoo muuttuneesta vasteesta. Ensimmäiset viisi koskevat aidosti
käyttäjälle olennaista driftin aloitusta/ohjausvastetta. Niitä ei poistettu eikä
nimetty automaattisesti vanhentuneiksi. Selainkokeiden vanha `steer === 0` -odotus
vapautuksessa tarvitsee lisäksi erillisen arvioinnin, koska C1:n avustus liikuttaa
fyysistä ohjausta myös ilman painettua nappia; sitä ei ole testattu WebGL-esteen takia.

## 9. Päätös ja seuraava rajattu tutkimus

**NO-GO sekä mergeen että julkaisuun.** Myös tavallisen Android-hyväksyntäajon
aloittaminen tällä ehdokkaalla on ennenaikaista; [ohje](digital-handling-c1-android.md)
on valmisteltu myöhempää erikseen sallittua paikallista diagnostiikkaa varten.

Säilytettävä oppi: yaw-nopeuteen sidottu, rajattu etupyörien ohjaus vähentää
vastakorjauksen ylilyöntiä myös samasta luistotilasta. Hylättävä kokonaisuus: nykyinen
painalluskeston/ohjausavun yhdistelmä ei vielä täytä driftin aloitusta, ennakoivaa
jarrutusta ja pitkäaikaista ajolinjan hallintaa samanaikaisesti.
Seuraava järkevä työ on eristää 180 s ennakoivan jarrutuksen ensimmäinen menetys
sekä lyhyen drift-aloituksen vaste saman 72 parin kiinniottosuojan alla.
Älä lisää yleisesti pitoa tai hidasta kameraa tämän raportin perusteella.

## Toistaminen

```sh
npm ci
npm test                         # tunnetusti 6 FAIL; älä ohita tulkinnassa
npm run test:baseline
npm run build
HANDLING_VERSIONS=v044,v045,v045b,v046,v046wgt HANDLING_OUTPUT=lab-results/integrated-baselines node scripts/integrated-handling-lab.mjs
HANDLING_VERSIONS=candidate HANDLING_OUTPUT=lab-results/integrated node scripts/integrated-handling-lab.mjs
HANDLING_VERSIONS=candidate HANDLING_OUTPUT=lab-results/integrated-final node scripts/integrated-handling-lab.mjs
node scripts/integrated-handling-extra.mjs
node scripts/handling-matched-entry.mjs
python scripts/summarize-integrated-handling.py
```

Täysi Git-historia tarvitaan arkistoiduille SHA:ille. `HANDLING_CASES` rajaa toiston
pilkuilla erotettuihin case-ID:ihin (CSV:n case-sarake); rajattua ajoa ei raportoida täytenä.
Skriptit eivät julkaise mitään. Raakatracet syntyvät valituista kolmesta tapauksesta
per versio; kaikista 1 458 tapauksesta säilytetään yhteenvedot ja mesh-tarkisteet.
