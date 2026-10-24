# GOPs Rally — ajotuntumaprototyyppi

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
