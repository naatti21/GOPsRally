# GOPs Rally — arcade-rallin 3D-prototyyppi

**Työnimi:** GOPs Rally. Tavoite: yksinkertaisesti ohjattava mobiili-arcade-ralli, jossa radan oppiminen palkitaan.

## Pelisuunnitelma v0.1

- Vasen / oikea / jarru. Kaasu on automaattinen.
- Ohjaus reagoi välittömästi; nopeus, pito, kallistus ja mutkan säde määräävät liikkeen.
- Mutkitteleva sorarata, korkeuserot, harjanteet ja kallistetut mutkat.
- Kolme kameramallia: lukittu ilmansuunta, hybridi, chase. Nopeudesta riippuva zoom ja ennakointi.
- Ensimmäinen tavoite on toimiva ajotuntuma. Myöhemmin haamuautot, piirretyn ajolinjan pelitila ja Supabase-moninpeli.

## Työskentely

Mobiili ensin. PWA, paikallinen tallennus, kevyt ja nopea. Ei muiden sovellusten kanssa jaettuja tiedostoja tai tietokantoja. Teknistä rakennetta ei päätetä peruuttamattomasti ennen ajotestiä.

## v0.1.1 — manuaalinen palautus

- Erillinen **RESET**-painike palauttaa auton viimeiselle turvalliselle rataosuudelle.
- Auto palautuu levosta, mutta mitään erillistä odotusajastinta ei ole.
- Kierros, kierrosaika ja ennätys eivät nollaudu palautuksesta.
- Automaattista metsään jääneen auton palauttamista ei tehdä.
- Maasto hidastaa liikkeen suuntaan, eikä automaattikaasu pakota autoa peruuttamaan.
- Kun **JARRU** pidetään pohjassa lähes pysähdyksiin, painike toimii myös pakkina.
- Englannin kieli, maaliviivan siirto, kameran oletusasetukset, ohjainnappien ergonomia ja visuaaliset päivitykset ovat edelleen v0.2-jatkokehitystä.

## Tämänhetkinen tilanne

Ensimmäinen testattava prototyyppi on tehty ja sen Node-smoke-testit ajettu. Varsinainen mobiiliselain- ja GitHub Pages -testaus ovat vielä tekemättä. Älä käsittele tätä vielä julkaisuvalmiina pelinä.

## Käynnistys ja testaus

1. GitHubissa **Settings → Pages → Build and deployment → Deploy from a branch**.
2. Valitse **main / (root)** ja tallenna. GitHub Pagesin osoite on tämän jälkeen `https://naatti21.github.io/GOPsRally/`, kun julkaisu valmistuu.
3. Avaa osoite puhelimella. Ohjaus on vasen–oikea, jarru keskellä; kaasu on automaattinen.
4. Kokeile kaikkia kameratiloja ja kerro, tuntuuko ohjaus välittömältä sekä näkyykö mutkaa riittävästi eteenpäin.

Node-smoke-testin saa ajettua reposta komennolla `node tests/smoke-test.cjs` (ei npm-riippuvuuksia).

### Rajaukset

Alkuvaiheen maastografiikka on omaan 2,5D-projektioon perustuva kevyt versio. Korkeudet ja banking on mallinnettu, mutta oikeaa 3D-jousitusta tai törmäysfysiikkaa ei vielä ole. Supabase-kytkentä tehdään vasta, kun yksinpelin käsiteltävyys on testattu.

## v0.2 — ajettavuus ja näkymä

- **English first:** tekstien, painikkeiden ja ilmoitusten oletuskieli on englanti.
- **Fixed by default:** lukittu ilmansuunta on kameran oletus, Hybrid/Chase ovat edelleen testattavissa.
- **Maaliviiva:** siirretty neulansilmästä pitkän suoran keskialueelle (rajan ylitys tunnistetaan suunnan ja rataetäisyyden perusteella).
- **Mobiiliohjaimet:** suuremmat ohjauspainikkeet ja korkeampi sijainti peukalolle.
- **Näkymä:** selkeämpi yläviisto, kevyesti näkyvä korin kallistus ja jarrutuksen aiheuttama nyökkäys.
- **Luistojäljet:** sivuttaisluisto jättää renkaanjälkiä, vanha auton soikea varjo on poistettu. Radalla syntyvä pöly säilyy.
- **Reset / Brake reverse:** v0.1.1:n manuaalinen reset ilman odotusviivettä ja jarrupainikkeella tarkoituksellisesti käytettävä pakki säilyvät.

### Rajaukset ja seuraavat kokeilut

Tässä versiossa kori keinuu yksinkertaisella visuaalisella mallilla. Kyseessä **ei** ole vielä todellinen nelipyöräinen 3D-jousitus- tai painonsiirtosimulaatio. Seuraavassa vaiheessa vertaillaan ajotuntumaa, korkeuserojen vaikutusta sekä eri vetotapoja/painopisteitä ennen uusien automallien lisäämistä.

### Testaus

Aja paikallinen JavaScriptin toimintatesti: `node tests/smoke-test.cjs`. Testi kattaa oletuskameran, englanninkieliset ohjaimet, maaliviivan sijainnin, auton käynnistymisen, ohjauksen, jarrun, kameran vaihdon ja resetin. Mobiililaitteella tehtävä kuvallinen ja käytettävyyden testaus vaatii edelleen pelaajan palautetta.

## v0.2.1 — lähtö ja kamera (24.10.2026)

- Hybrid-kamera poistettu. Valittavat kamerat: **FIXED** (oletus) ja **CHASE**.
- Lähtöpaikka ja maaliviiva ovat samalla pitkän suoran pisteellä, auto osoittaa radan ajosuuntaan.
- **START DRIVING** aloittaa kahden sekunnin **2 → 1 → GO!** -laskennan. Auto pysyy paikallaan, kunnes laskenta on päättynyt.
- Kierrosaika alkaa vasta lähdöstä, joten lähtölaskenta ei maksa kierrosaikaa.
- Tauolta jatkaminen ei aloita uutta lähtölaskentaa.
- **RESET** palauttaa välittömästi radalle kuten ennenkin; lähtölaskenta ei koske palautusta.
- PWA:n offline-välimuistin versio nostettu uudistusten lataamista varten.

Testi: `node tests/smoke-test.cjs`. Selain-/puhelintestaus kuuluu edelleen käyttäjätestiin.

## v0.3 — oikea 3D-renderöinti (koeversio)

- **Uusi `renderer3d.js`:** natiivi WebGL2-renderöinti, ei CDN- tai npm-riippuvuuksia. Mukana oikeasti kolmiulotteinen maaston korkeusverkko, tien kallistukseen mukautuva tien pinta, matalapolygoninen metsä ja autolle 3D-kori sekä neljä erillistä pyörää.
- **Neulansilmän piirtovirheen korjaussuunta:** tien pinta on nyt yhtenäistä 3D-kolmioverkkoa syvyystestillä vanhan 2D-maalarijärjestyksen sijaan. Tämä ei vielä todista, että kaikki erikoisristeämät ovat virheettömiä; tarkistetaan puhelimella.
- **Korin liike:** ohjaus ja jarru kallistavat kolmiulotteista koria, maaston erot liikuttavat pyöriä toisistaan riippumatta. Tämä on visualisointi, **ei** aito jousitusdynaamikan / rengasvoimien simulaatio.
- **Aiempi toimiva ajofysiikka ja ohjaus säilyvät**; 3D on renderöintikerros. Fixed ja Chase, lähtölaskenta, lähtö/maali suoralla ja manuaalinen Reset eivät muutu.
- **Varmistettu 2D-varatila:** mikäli WebGL2 ei käynnisty tai renderöinti kaatuu, vanha piirto tulee käyttöön.
- Päivitetty PWA-välimuisti sisältää `renderer3d.js`-tiedoston ja tukee edelleen offline-käyttöä.

**Testaus:** `node tests/3d-smoke-test.cjs` validoi 3D-verkkojen kärkipisteiden ja matriisien numeerisuuden, autonosien piirtokutsut sekä Fixed/Chase-kamerat. `node tests/smoke-test.cjs` validoi vanhan ajologiikan. Nämä eivät korvaa oikean WebGL2-selaimen testausta; visuaalisuus ja suorituskyky ovat vielä käyttäjätestissä arvioitavia.

**Hätäpalautus:** jos 3D-näkymä ei toimi puhelimessasi, avaa `https://naatti21.github.io/GOPsRally/?graphics=2d` palataksesi vanhaan 2D-näkymään ilman tiedostopäivitystä.\n\n**Seuraava vaihe:** arvioi puhelimella erityisesti näkymän kallistus, auton koko, korkeuserojen luettavuus, renkaiden näkyvyys ja neulansilmän pinta. Jos WebGL2-versiossa on ongelma, tallenna kuvakaappaus sekä kerro kumpi kamera oli valittuna.

## v0.3.1 — 3D-road height and steering hotfix

**Bugs reported from the real mobile 3D test:** on uneven and banked sections, the car could appear inside the road or terrain, and steering felt horizontally inverted.

- `renderer3d.js` now computes the car's four wheel contact heights from the same road centerline and banking data that builds the road ribbon; the previous ground-only tire height query has been removed.
- The underlying terrain grid is locally recessed beneath the ribbon and blended back into the natural hills outside the road. Grid spacing is finer, and vertex height calculations are cached at build time.
- Camera horizontal projection is aligned to the established driving coordinate system so screen-right matches right steering in **both** Fixed and Chase.
- Skid marks and camera target height use the shared road-height sampling too.
- No change to steering forces, input sensitivity, the start countdown, or the manual Reset behavior.
- PWA cache updated to `v0.3.1`.

**Verification:** `node tests/3d-smoke-test.cjs` checks ground clearance, wheel position relative to road, and fixed/chase camera handedness. `node tests/smoke-test.cjs` remains the driving regression suite. Automated GL stubs **do not** prove real-phone visual correctness; this build still needs a mobile GPU test.
