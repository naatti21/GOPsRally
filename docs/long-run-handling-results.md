# Pitkän ajon tutkimustulokset — v0.4.7

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
| v044 | Tasainen vakiosäde | 4 | 0 | 0.00 | 53.78 | 1 |
| v044 | Todellinen rallimaasto | 32 | 0 | 1.32 | 41.96 | 0 |
| v045 | Tasainen vakiosäde | 54 | 2 | 2.43 | 35.95 | 1 |
| v045 | Todellinen rallimaasto | 36 | 12 | 36.00 | 36.02 | 0 |
| v045b | Tasainen vakiosäde | 56 | 2 | 1.55 | 35.94 | 1 |
| v045b | Todellinen rallimaasto | 33 | 9 | 49.28 | 37.47 | 0 |
| v046 | Tasainen vakiosäde | 53 | 2 | 2.43 | 36.46 | 1 |
| v046 | Todellinen rallimaasto | 32 | 12 | 53.27 | 35.03 | 0 |

[Kaikkien neljän version aikasarjakuva](metrics/long-run/long-run-comparison.png). Heiluntasyklien määrä ei yksin ole laatupiste: pitkä ulosajo tai spinnaus voi vähentää laskettavia suunnanvaihtoja.

## Ohjauspulssi ja vastakorjaus

100 km/h, ensin RIGHT 650 ms, sitten 300 ms vapautus ja LEFT 300 ms. Taulukon vapautusvertailussa LEFT puuttuu kokonaan. Poikittainen sijainti mitataan 6 sekunnin kohdalla alkuperäisestä suorasta; molemmat autot saavat jatkaa liikkumista vapaasti.

| Versio | Vapautuksen suurin luisto ° | Vastakorjauksen suurin luisto ° | Vastakorjauksen suurin yaw °/s | Vapautuksen sivusiirtymä m | Vastakorjauksen sivusiirtymä m | Korjauksen loppunopeus km/h |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v044 | 0.68 | 0.68 | 28.32 | 53.32 | 33.00 | 133.69 |
| v045 | 12.62 | 38.37 | 88.18 | 67.53 | -32.65 | 107.33 |
| v045b | 12.42 | 40.19 | 89.31 | 70.54 | -33.59 | 104.47 |
| v046 | 11.58 | 41.70 | 85.89 | 73.24 | -41.66 | 119.45 |

Korjaus voi pienentää lopullista poikkeamaa mutta samalla kääntää sen vastakkaiselle puolelle, kasvattaa yaw-nopeutta ja hidastaa autoa. Siksi pieni loppuluisto tai suuri huippuluisto yksin ei osoita hallittavuutta. [Ohjaus, luisto, yaw ja kuljettu sivupolku](metrics/long-run/delayed-countersteer.png).

v0.4.6:n luiston huippu eri reagointi- ja painallusajoilla samasta 100 km/h / 650 ms sisäänmenosta:

| Vastakorjauksen viive | LEFT 200 ms | LEFT 300 ms | LEFT 400 ms |
| --- | ---: | ---: | ---: |
| 0.10 s | 11.28° | 31.46° | 57.26° |
| 0.20 s | 11.61° | 39.24° | 59.75° |
| 0.30 s | 12.58° | 41.70° | 60.47° (spinout) |
| 0.45 s | 17.04° | 45.90° | 53.28° |

**200–400 ms painallukset eivät muodosta tasaista anteeksiantavaa ikkunaa:** 200 ms korjaus on tässä kokeessa maltillinen, 300 ms tuottaa 31–46° ja 400 ms jopa spinout-jakson. Tämä on painalluksen keston herkkyyttä, ei vain reaktioajan ongelma. 70 ja 126 km/h sekä lyhyet/pitkät sisäänmenot ovat mukana koko numeerisessa aineistossa; johtopäätöstä ei rakenneta ainoan 100 ms onnistumisen varaan.

## Maaston ja pinnan erottelu

v0.4.6, sama 100 km/h lähtö ja 150 s ajuri:

| Koe | Spinout-jaksot | Pyörä rajan ulkopuolella, s | Heiluntasyklit |
| --- | ---: | ---: | ---: |
| oval-flat-100 | 2 | 2.43 | 53 |
| oval-low-100 | 31 | 66.23 | 35 |
| oval-transition-100 | 26 | 25.00 | 42 |
| oval-banked-100 | 3 | 5.15 | 53 |
| oval-uneven-100 | 7 | 14.22 | 48 |
| real-full-100 | 12 | 53.27 | 32 |
| real-uniform-100 | 6 | 18.63 | 45 |
| real-flat-100 | 9 | 34.83 | 44 |

Tasaisen radan ongelma sulkee pois väitteen, että heilunta vaatisi töyssyjä. Todellisen radan tasainen pitoluokitus vähentää ulosajoa mutta ei poista ongelmaa. Korkeuserojen poistaminen ei myöskään korjaa sitä. Nämä ovat fyysisen järjestelmän ja saman ajurin vuorovaikutuskokeita: ajolinjan muutokset vaikuttavat myöhempiin nopeuksiin ja kontakteihin. Yhden tietyn töyssyn kausaalista osuutta ei voi päätellä pelkistä kokonaisluvuista.

[Pyörien kuormat, jousituksen liike, pitch ja roll](metrics/long-run/loads-and-body.png). Yksikään vertailuajo ei poistunut törmäysmeshin alueelta; ulosajoja ei siivottu resetillä. Vakio-ohjaus 15 s ja sitä seuraava 135 s vapautus eivät tuottaneet itsestään jatkuvaa suunnanvaihtoheiluntaa näillä lähtönopeuksilla. Tämä tukee syötteen vaihtumisen/palautesilmukan merkitystä, ei todista kaikkia rengastiloja stabiileiksi.

## Kamera samasta fysiikasta

Kaikille seuraaville näytetään täsmälleen sama 9 000 askeleen v0.4.6-maastoajo. Rungon heading-nopeuden RMS on 69.42°/s.

| Renderöijä | Kamera | Kameran heading-nopeuden RMS °/s | Auton keskipiste näkymän ulkopuolella, ruutua |
| --- | --- | ---: | ---: |
| v044 | fixed | 1.45 | 0 |
| v044 | chase | 64.70 | 0 |
| v045 | fixed | 1.45 | 0 |
| v045 | chase | 60.30 | 0 |
| v045b | fixed | 1.45 | 0 |
| v045b | chase | 60.30 | 0 |
| v046 | fixed | 1.45 | 0 |
| v046 | chase | 60.32 | 0 |
| v046-tau0.2 | fixed | 1.45 | 0 |
| v046-tau0.2 | chase | 57.37 | 0 |

[Identtisen fysiikan kameravertailu](metrics/long-run/camera-replay.png). 90 → 200 ms heading-suodatus vähentää Chase-liikettä vain vähän. Se ei muuta rungon liikettä lainkaan. Kamera voi silti vaikuttaa ihmisen havaintoihin ja painalluksiin; sitä ei tässä offline-toistossa mitata. Keskipisteen näkyvyys ei yksin takaa koko auton, tien tai HUDin hyvää näkyvyyttä. Android-ruudunpäivitys ja kosketusviive ovat **NOT MEASURED**.

## Rajattu yhden parametriperheen seulonta

Kaikki muutokset tehtiin väliaikaisiin v0.4.6-lähdearkistoihin vasta lähtövertailun jälkeen. Alla kaksi 150 s testiä; muut 6 s korjauskokeet ja tarkat muutokset/hajautukset ovat [seulonta-aineistossa](metrics/long-run/sweep-summary.json).

| Muutos | Tasaisen radan spinoutit / ulkona s | Oikean radan spinoutit / ulkona s |
| --- | ---: | ---: |
| baseline | 2 / 2.43 | 12 / 53.27 |
| rack | 11 / 40.00 | 13 / 36.13 |
| authority | 8 / 38.73 | 10 / 36.42 |
| slopes | 2 / 5.88 | 10 / 33.12 |
| relaxation | 2 / 2.05 | 11 / 49.95 |
| damping | 2 / 2.10 | 12 / 63.75 |
| suspension | 2 / 3.08 | 11 / 44.10 |
| driveSplit | 2 / 1.62 | 11 / 55.35 |
| cornerTorque | 14 / 36.58 | 2 / 9.43 |
| postPeak | 2 / 1.63 | 9 / 42.70 |

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

Lopulliset paikalliset testitulokset ja suorittamatta jääneet tarkistukset: [validointikirjaus](long-run-validation.md).
