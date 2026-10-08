# Conversie-analyse Dar Al Scents – 8 okt 2026 (kritisch)

## Cijfers laatste 14 dagen (Shopify Analytics)
- 2.081 sessies. Daarvan ±360 bots (VS 327 met 0,3 s gemiddelde duur, Singapore, Rusland). **Echte bezoekers ±1.720.**
- Echte webshop-bestellingen: **1** (#1012, 5 okt, NL, iDEAL). #1005–#1011 zijn handmatige conceptorders (`shopify_draft_order`, betaald "manual") en tellen niet als conversie. → **echte conversie ±0,06%**.
- Funnel: 26 sessies met winkelmand (1,3%) → 19 in kassa → 1 betaald (webshop). Slechts 7 verlaten kassa's in 5 weken.

| Land / apparaat | Sessies | Bounce | Gem. duur | Pagina's/sessie | Winkelmand | Kassa | Besteld |
|---|---|---|---|---|---|---|---|
| België mobiel | 1.351 | 95% | **7 sec** | 1,2 | 10 | 6 | 0 |
| Nederland (mob+desk) | 349 | 42% | 136 sec | 4,0 | 14 | 12 | 1 web (+ tests/concepten) |
| VS desktop | 324 | 100% | 0,3 sec | 1,0 | 0 | 0 | 0 (bots) |

- Bron: "direct" 1.207 (grotendeels TikTok in-app browser, België), TikTok 820 (2 winkelmanden), Google 31, Facebook 29.
- Landingspagina's: homepage 1.228; oude TikTok-link Angham Second Song 250 (redirect ging naar /collections/all); /password 38.

## Diagnose
1. **Verkeersprobleem, geen kassaprobleem.** 95% van de Belgische TikTok-bezoekers is binnen 7 seconden weg en ziet 1 pagina. Wie wél blijft (NL) gedraagt zich normaal. De site kan dit niet oplossen; de belofte in de video moet aansluiten op de pagina waar mensen landen.
2. **Video → verkeerde pagina.** De TikTok-video over Angham Second Song stuurde 250 mensen naar "alle producten" i.p.v. het product. → 8 okt opgelost (redirect naar nieuw product). Homepage als landing voor productvideo's = verlies.
3. **Geen social proof**: 1 review in de hele winkel (Hawas Fire). Nieuwe, onbekende winkel + geen reviews = geen vertrouwen voor impulsaankoop.
4. **Prijs/aanbod**: Angham Second Song €59,95 (hoog voor impuls via TikTok); 10 producten alleen als sample leverbaar, 17 helemaal niet (stand 6 okt).
5. **België-specifiek**: Bancontact niet bevestigd; Hoppy-korting geeft BE nog gratis verzending vanaf €60 (conflicteert met €75-regel).
6. Doel 3% per 100 sessies: alleen haalbaar op warm verkeer (NL, Google, terugkerend). Gemiddelde Shopify-winkel ±1,4%; koud TikTok-verkeer 0,3–1%.

## Gedaan 8 okt
- Redirect `/products/lattafa-angham-second-song-eau-de-parfum-100-ml` → `/products/lattafa-angham-second-song-edp` (was /collections/all).
- Redirect oude Honor & Glory-URL → `/products/lattafa-badee-al-oud-honor-glory-edp` (was /collections/unisex).
