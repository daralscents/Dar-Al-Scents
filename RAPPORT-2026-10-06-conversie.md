# Conversie-analyse Dar Al Scents – 6 okt 2026

## Cijfers (22 sep – 6 okt, Shopify Analytics)
- 2.061 sessies → 20 met winkelmand (1%) → 23 naar kassa → 8 afgerond.
- Webshop-bestellingen sinds sept: alleen #1004, #1006, #1012 (rest zijn handmatige conceptorders).
- **België: 1.380 mobiele sessies (65% van alle verkeer), 6 naar kassa, 0 bestellingen.**
- TikTok: 882 sessies, 1 winkelmand. Veel "direct"-verkeer uit België is ook TikTok (in-app browser geeft geen referrer).
- VS: ±370 sessies, 0 winkelmand → vrijwel zeker bots; telt mee in "sessies" maar zijn geen klanten.
- Top-landingspagina na de homepage: `/products/lattafa-angham-second-song-eau-de-parfum-100-ml` (251 sessies) – een **verwijderd Fragra-product** (TikTok-video verwijst ernaar). Ook `/products/lattafa-eclaire-banoffi-eau-de-parfum-100-ml` (64, oud Fragra-product).
- Vanaf 4 okt zakt verkeer van ±200 naar ±20 sessies/dag: TikTok-verkeer is gestopt (video/advertentie uit of afgekeurd).

## Belangrijkste oorzaken
1. **Verzendkosten België €12,95** (zat in de zone "EU"), terwijl site en beleid €6,95 beloofden. Op een parfum van €30 is dat 40% extra → Belgen haakten af in de kassa.
2. **TikTok-video verwijst naar producten die niet meer bestaan/uitverkocht zijn** (Angham Second Song, oude Banoffi-link).
3. Weinig voorraad: ±22 van 38 producten leverbaar.
4. Mobiel (82%) zonder snelle betaalknoppen op de productpagina.

## Doorgevoerd (live)
- Verzendzone **België** aangemaakt: €4,95 (gelijk aan NL); België uit de EU-zone (€12,95) gehaald.
- Automatische korting "Gratis verzending vanaf €60" geldt nu voor NL, DE, CH, PL (België eruit).
- Nieuwe automatische korting **"Gratis verzending België vanaf €75"** (combineert niet met andere kortingen, net als de NL-regel).

## Thema v8 (ID 210649547101, eigenaar publiceert)
- Productpagina: snelle betaalknoppen (Apple Pay / Google Pay / Shop Pay) aan.
- Winkelmand-verzendbalk: drempel €75 voor bezoekers uit België (via `localization.country`), €60 voor de rest.

## Eigenaar
- Verzendbeleid aanpassen: België €4,95, gratis vanaf €75 (Claude heeft geen schrijfrechten op beleid).
- TikTok: link in bio/video naar een product dat op voorraad is; check of de advertentie is gestopt/afgekeurd.
- Bancontact aanzetten (Mollie of Shopify Payments) – dé betaalmethode in België.
