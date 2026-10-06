# Dar Al Scents – projectcontext

Shopify-parfumwinkel **Dar Al Scents** (daralscents.nl, admin-handle `dar-al-scents`, myshopify: dar-al-scents.myshopify.com).
Communiceer met de eigenaar in het **Nederlands**.

## Vaste afspraken
- Dit is een **LIVE winkel** met klanten. Wijzig alleen wat gevraagd wordt.
- Pas **nooit zelf prijzen** aan.
- Verwijder **nooit definitief**: alleen archiveren.
- Vraag akkoord vóór grote wijzigingen (thema's, winkelinstellingen, bulk-updates).
- **Geen sterretjes (✦ / reviewsterren) in Oduree-stijl.** Referentiesites (Oduree, Berfume) zijn alleen inspiratie voor de premium ervaring, nooit om elementen te kopiëren. Het logo van Dar Al Scents vervangt boogjes/iconen.
- Shopify GraphQL-volgorde: `graphql_schema` → operatie bouwen → `validate_graphql_codeblocks` → `graphql_query` / `graphql_mutation`.
- Themabestanden kunnen alleen op **niet-gepubliceerde** thema's worden geschreven: dupliceer het live thema, pas de kopie aan, de eigenaar publiceert zelf.
- `templates/page.json` in thema v4 is door de eigenaar zelf aangepast: niet overschrijven.
- Grote API-resultaten verwerken met jq/python op het weggeschreven bestand.

## Huidige stand
- Live thema (sinds 3 okt ±18:01): **"Dar Al Scents – premium v7 (winkelmand upsell)"** (ID 210581520733) = v6 + winkelmand-upsell. Toekomstige themawijzigingen op een kopie van v7. Oorspronkelijk gebaseerd op v4: (Dawn 15.4.0-basis, eigen "Maison"-stijl: ivoor, zwart, goud; Cormorant + Jost).
- In v4: Geurwijzer-quiz (`/pages/geurwijzer`, knop rechtsboven in de header), chat-assistent "Hulp nodig?", logo in merkenband/chat/reviews, NL-filternamen, slanke Hoppy-verzendbalk.
- Talen: NL (standaard), DE (`/de`), FR (`/fr`), EN (`/en`) actief op daralscents.nl en myshopify-domein. Thema (630 teksten), menu's, 14 collecties, 8 pagina's (incl. B2B) en alle 90 actieve producten (beschrijving + SEO) zijn vertaald.
- SEO: alle 90 actieve producten hebben SEO-titel (≤ 60 tekens) en omschrijving (gecontroleerd 3 okt). 226 alt-teksten ingevuld.
- Badges van 1505 Watch staan in eigen Shopify-bestanden.
- Producten komen binnen via **Syncee**. Tags: `FRAG` = leverancier Fragra, `LUAR` = leverancier Luxus Aroma.

## Opschoning 3 okt 2026 (afgerond, zie `RAPPORT-2026-10-03.md`)
- 57 producttitels gestandaardiseerd naar `Merk Naam EDP 100ml` (producten met Sample-variant zonder inhoud in de titel). Handles ongewijzigd; Geurwijzer werkt op handles. DE/FR/EN-titels gelijkgezet.
- Producttypes: Eau de Parfum / Extrait de Parfum / Eau de Toilette / Body mist / Giftset. Smart collectie "Sprays" filtert op titel "spray" of type "Body mist".
- Alle 90 actieve producten in minstens één collectie en met SEO-omschrijving (NL + DE/FR/EN). Nieuwe SEO-teksten noemen geen designer-merken.
- Alle 14 collecties hebben SEO-omschrijving (+ vertalingen) en afbeelding. "Bundel: Day & Night" titel gerepareerd.
- Vertaal-digest = SHA-256 van de brontekst (handig voor `translationsRegister`).
- Back-up vóór opschoning: `backups/2026-10-03-producten-voor-opschoning.json`.

## Fragra-koppeling gestopt (3 okt 2026, 12:03)
- Syncee-koppeling met Fragra werkt niet meer. Alle 57 producten met tag `FRAG` zijn gearchiveerd (via de Claude Connector, vanuit een ander gesprek) en uit alle verkoopkanalen gehaald. **Eigenaar wil ze NIET terugzetten.**
- Actief: 33 producten (32 `LUAR` + Lattafa The Kingdom for Men zonder leverancierstag).
- Gevolg voor collecties: Giftset, Sprays en "Bundel: Day & Night" zijn leeg; Gourmand-bundel heeft 1 van 3; Dames Parfum nog maar 4 actieve producten; TikTok Favorieten 2.
- Geurwijzer-data (`snippets/maison-geurwijzer-data.liquid`) bevat nog handles van gearchiveerde producten.
- Collectieafbeeldingen van Winter Heren/Dames, Zomer Dames, Speciale Editie, Giftset, Sprays en beide bundels tonen nu gearchiveerde producten.
- Vervanging: zoveel mogelijk via Luxus Aroma (of andere leverancier) in Syncee importeren. Werklijst met EAN's: `fragra-vervangen.csv` (57 producten, gesorteerd Dames → Unisex → Heren).
- 3 okt: "Sprays" uit hoofdmenu (Parfum) gehaald; Giftset/bundels stonden niet in menu's en worden niet op de homepage gelinkt. Terugzetten in menu zodra er weer sprays zijn.
- 3 okt: collectieafbeeldingen vervangen door actieve producten: Winter Dames (Hawas Reina), Speciale Editie (Liquid Brun Limited), Zomer Dames (Hawas Eclat), Gourmand-bundel (Eclaire Pistache). Winter Heren: update geeft geen fout maar bestandsnaam blijft "Eternal_Oud" → eigenaar visueel controleren, anders handmatig vervangen in admin.
- Lege collecties (Giftset, Sprays, Day & Night) houden hun oude afbeelding; niet zichtbaar zolang leeg.

## Opbouw op huidige voorraad (3 okt 2026)
- 35 actieve producten (2 nieuw via Syncee om 12:28: Khadlaj Island, Armaf Odyssey Spectra — alleen 3ml-variant). 19 met voorraad, 16 uitverkocht.
- Keuze eigenaar: uitverkochte blijven online maar onderaan; unisex-geuren staan ook in Dames én Heren.
- Collecties Dames (25), Heren (30), Unisex (21), Winter Heren (22), Winter Dames (17), Zomer Heren (14), Zomer Dames (13) aangevuld. Alle collecties op handmatige sortering: voorraad eerst (meeste voorraad bovenaan), uitverkocht onderaan. Deze volgorde is statisch: bij nieuwe voorraad/producten opnieuw sorteren.
- Sample-varianten heten nu "3ml" (€15,95) — gewijzigd door Syncee-sync, niet door Claude.

## Nieuwe producten afgemaakt (3 okt 2026)
- Khadlaj Island Extrait de Parfum (unisex, winter) en Armaf Odyssey Spectra EDP (heren, jaarrond): NL-beschrijving in huisstijl, SEO, producttype, DE/FR/EN-vertalingen, alt-teksten. Leveranciersverwijzingen (Luxus Aroma GmbH) uit de klanttekst gehaald.
- Nog toe te voegen aan Geurwijzer-data (bij volgende themakopie, `snippets/maison-geurwijzer-data.liquid`):
  `{"h":"khadlaj-frische-ext-de-parfum","g":"u","f":["fris","oriental"],"n":["citrus","amber","vanille","muskus"],"s":"w","m":"a"}`
  `{"h":"armaf-odyssey-spectra-edp-100ml","g":"h","f":["fruitig","gourmand","oriental"],"n":["fruit","citrus","amber","muskus"],"s":"j","m":"a"}`
  Tegelijk handles van gearchiveerde Fragra-producten uit de data halen.

## Homepage-fix (3 okt 2026)
- Probleem: hero op homepage verwees naar gearchiveerd `lattafakhamrah-edp-100ml` → lege placeholder bovenaan. Geurwijzer toonde vaak geen resultaat (top-9 vooral gearchiveerde producten).
- Kopie gemaakt: **"Dar Al Scents – premium v5 (homepage fix 3 okt)"** (ID 210577785181), identiek aan v4 behalve:
  - `templates/index.json`: hero-product → `armaf-club-de-nuit-overdose`.
  - `snippets/maison-geurwijzer-data.liquid`: alleen de 35 actieve producten (incl. Khadlaj Island, Odyssey Spectra).
- Eigenaar moet v5 publiceren (Claude kan niet publiceren). Preview: https://daralscents.nl/?preview_theme_id=210577785181
- Na publicatie is v5 het live thema; toekomstige themawijzigingen op een kopie van v5 doen.
- Nog zwak: sectie "TikTok favorieten" op de homepage toont 2 uitverkochte producten.

## Geurwijzer-fix (3 okt 2026)
- Probleem: in het live thema (210579161437, "Bijgewerkte kopie van … premium v…", door eigenaar gepubliceerd 14:32) bevatte `templates/page.geurwijzer.json` alleen een "main-page"-sectie → de quiz stond niet meer op `/pages/geurwijzer`.
- Kopie gemaakt: **"Dar Al Scents – premium v6 (geurwijzer fix 3 okt)"** (ID 210579685725), identiek aan live behalve:
  - `templates/page.geurwijzer.json`: sectie `maison-geurwijzer` hersteld (collecties heren-parfum-1 / dames-parfum / unisex).
  - `snippets/maison-geurwijzer-data.liquid`: 35 actieve producten, maar Liquid toont alleen producten die `available` zijn (via `collections.all.products limit: 250`). Uitverkochte producten komen dus vanzelf terug zodra er voorraad is.
  - Let op: `collections.all` geeft zonder paginate max. 50 producten. Groeit de winkel boven 50, dan dit filter aanpassen.
- Eigenaar moet v6 publiceren. Preview: https://daralscents.nl/?preview_theme_id=210579685725
- Na publicatie is v6 het live thema; toekomstige themawijzigingen op een kopie van v6 doen.

## Website-audit (3 okt 2026, middag) – zie `RAPPORT-2026-10-03-audit.md`
- **Fragra-producten zijn volledig verwijderd** (niet gearchiveerd): totaal 72 producten, 38 actief, 34 gearchiveerd. Back-up in `backups/`.
- 3 nieuwe producten afgemaakt (Banoffi, Rayhaan Elixir, 9PM Night Out): titel, type, SEO, alt, DE/FR/EN, collecties, Geurwijzer.
- TikTok Favorieten (9) en Bestsellers (11) gevuld met voorraad vooraan; Dames/Heren/Unisex/Winter opnieuw gesorteerd.
- 94 URL-redirects (91 producten + 3 pagina's) voor verdwenen/gearchiveerde producten + 3 lege pagina's (heren/dames/unisex-parfum, nu verborgen). Lijst: `backups/2026-10-03-redirects.json`.
- Extra in thema v6 (210579685725): page.b2b.json (main-page-b2b) hersteld, page.reviews.json nieuw (Reviews-pagina toonde "Over ons"), uitgelicht product op collectiepagina's vervangen, promoblokken met oude producten en nep-badge "1,000+ sold" uitgezet, merkteksten (geen Faris/Nusuk/Maison Alhambra) + vertalingen, 3 nieuwe producten in Geurwijzer-data.
- Claude heeft geen `write_legal_policies`: placeholders in wettelijke kennisgeving moet eigenaar invullen.
- Thema-vertalingen zijn per thema: na tekstwijziging in een kopie `translationsRegister` op `gid://shopify/OnlineStoreTheme/<id>` met de nieuwe digest.

## Winkelmand-upsell (3 okt 2026) – thema v7
- Kopie **"Dar Al Scents – premium v7 (winkelmand upsell)"** (ID 210581520733) van v6. Gepubliceerd door eigenaar 3 okt ±18:01.
- Nieuw: `snippets/maison-cart-upsell.liquid` (kopie in `theme-snippets/`), gerenderd in `snippets/cart-drawer.liquid` direct onder de producttabel.
- Werking: nieuwste product staat bovenaan (Shopify zet nieuwste regel eerst); daaronder 1 aanbevolen product via `/recommendations/products.json?intent=related` op basis van het laatst toegevoegde product, anders uit Best Sellers. Slaat producten over die al in de mand zitten of uitverkocht zijn. Knop "Toevoegen" voegt toe via `/cart/add.js` en ververst de drawer. Teksten NL/DE/FR/EN in de snippet.

## Conversie-analyse + verzending (6 okt 2026) – zie `RAPPORT-2026-10-06-conversie.md`
- 65% van het verkeer is Belgisch mobiel (TikTok), 0 bestellingen. Oorzaak o.a. verzendkosten BE €12,95 (EU-zone).
- Verzending nu: NL €4,95, gratis ≥ €60 (korting "Gratis verzending vanaf €60": NL/DE/CH/PL). **BE: eigen zone €4,95, gratis ≥ €75** (korting "Gratis verzending België vanaf €75"). Besluit eigenaar.
- iDEAL werkt via Mollie (order #1012) – open punt 4 vervalt.
- Thema **v8 (conversie)** ID 210649547101 = v7 + snelle betaalknoppen op productpagina + verzendbalk €75 voor BE. Eigenaar moet publiceren.
- VS-verkeer (±370 sessies/2 wk) = bots.

## Knop-fix (6 okt 2026) – thema v9
- v8 is door eigenaar gepubliceerd. Fout: met snelle betaalknoppen maakt Dawn "Aan winkelwagen toevoegen" `button--secondary` → zwarte tekst op zwarte Maison-knop (onzichtbaar).
- **v9 (knop fix)** ID 210651283805 = v8 + `snippets/buy-buttons.liquid` altijd `button--primary`. Eigenaar moet publiceren.
- Hoppy Free Shipping (app-korting "fblink…"): gratis verzending ≥ €60 voor álle landen (ook BE → overrulet BE €75-regel), gratis cadeau ≥ €100 verwijst naar **niet-bestaande variant 65940863648093** (verwijderd Fragra-product), €20 korting ≥ €400. Teksten Engels. Alles aanpassen in de Hoppy-app zelf (eigenaar).

## Open punten
1. **Overstap Fragra → Luxus Aroma** (zie `OVERDRACHT.md` voor de productlijst):
   - (Fragra gestopt: alle 14 zijn gearchiveerd; zo snel mogelijk via Luxus importeren.) Producten 1–8 nu overzetten, met Sample-variant (€14,95, SKU `<EAN>-SAMPLE`). Prijs 100ml niet aanpassen.
   - Producten 9–14 pas overzetten als Luxus weer voorraad heeft.
   - Eerst in Syncee uitzoeken: kan een bestaand product op SKU/EAN gekoppeld worden (route B) of moet er nieuw geïmporteerd worden en het oude gearchiveerd (route A)?
   - Syncee-UI was lastig via Chrome te bedienen ("Setup guide"-venster blokkeerde klikken).
2. Hoppy Free Shipping: klantteksten nog Engels ("You're only … away from free shipping!"). Aanpassen in de app zelf.
3. Klaviyo Customer Agent: nog niet geactiveerd. Na activatie kennisbank vullen.
4. ~~iDEAL~~ werkt via Mollie. Wel nog: Bancontact voor België controleren/aanzetten.
5. Nieuwe producten komen niet vanzelf in de Geurwijzer-data: handmatig toevoegen.
6. 31 producten hebben maar 1 foto: extra beelden nodig (eigenaar/leverancier).
7. EAN ontbreekt op 100ml-variant van 7 producten (Khamrah Waha, Musamam Black Intense, Hawas Malibu, Hawas Fire, Vulcan Baie, Ana Abiyedh Rouge, Como Moiselle): opzoeken in Syncee.
8. 15 thema's (max 20): oude thema's kan alleen de eigenaar verwijderen.
9. Oudere SEO-teksten (±37 producten) noemen designer-parfums ("in de sfeer van …"): merkenrechtelijk risico, eventueel herschrijven.
