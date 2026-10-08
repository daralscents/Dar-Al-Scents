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

## Hoppy-balk verborgen (7 okt 2026) – thema v10
- v9 (knop fix) is door eigenaar gepubliceerd.
- **v10 (zonder Hoppy-balk)** ID 210651906397 = v9 + `assets/maison-apps.css`: alle Hoppy/Futureblink-elementen (`[class*="futureblink"]`) verborgen, oude Hoppy-styling eruit. App-embed staat nog aan (Hoppy-korting in de kassa blijft werken). Eigen NL-verzendbalk in winkelmand + aankondigingsbalk blijven. **v10 is gepubliceerd (live, gecontroleerd 6 okt).** Toekomstige themawijzigingen op een kopie van v10.
- Shopify-connector was gekoppeld aan verkeerde winkel ("Van der Voet"); eigenaar heeft opnieuw gekoppeld aan Dar Al Scents (6 okt). Bij start altijd `get-shop-info` checken.
- Ook in v10 (catalogus, 7 okt): `templates/collection.json` (geldt voor /collections/all en alle collecties zonder eigen template; Dames/Heren/Unisex hebben eigen templates en zijn NIET aangepast): productgrid direct onder de banner, 24 per pagina, 4 kolommen (mobiel 2), vierkante foto's, tweede foto bij hover, merknaam, snel toevoegen, horizontale filters + sortering. Dubbele blokken (uitgelicht product, Best Sellers-kopie) uit; categorieblok onder het grid. CSS-blok "Catalogus" in `assets/maison-apps.css`: zandkleurige tegels met hele flesfoto (contain), titels max. 2 regels in Cormorant, goud merklabel, strakke badges/knoppen, filterbalk met lijnen. Thema heet nu "Dar Al Scents – v10 (Hoppy uit + catalogus)". Preview: https://daralscents.nl/collections/all?preview_theme_id=210651906397

## Conversie-update collectiepagina's + nieuwe producten (6/7 okt 2026) – thema v10
- Eigenaar had v9 tijdelijk terug live gezet; v10 (210651906397) verder aangepast en **door eigenaar gepubliceerd 6 okt ±13:49 (gecontroleerd: alle bestanden kloppen)**. Toekomstige themawijzigingen op een kopie van v10.
- Dames/Heren/Unisex-templates (`collection.dames-parfum/heren-parfum/unisex-parfum.json`) gelijk aan `collection.json`: banner → productgrid (24/pagina, vierkant, snel toevoegen, filters) → "Bekijk ook" (andere 2 categorieën) → nieuwsbrief. Uitgelicht product, nep-badge, lege "Best seller #1", Winter-dubbelblok en image-with-text verwijderd (staan nog in v9).
- Productkaart-prijs: `snippets/price.liquid` is nu een wrapper; originele Dawn-snippet staat als `snippets/price-dawn.liquid`. Kaarten (price_class '' + show_compare_at_price, geen use_variant) renderen `snippets/maison-card-price.liquid`: hoofdprijs = grote fles i.p.v. "Vanaf €15,95", regel "Ook als sample · €15,95", "Nog maar X op voorraad" bij 1–5 stuks (echte voorraad), en als grote fles uitverkocht is maar sample niet: sampleprijs + "100ml tijdelijk uitverkocht". Teksten NL/DE/FR/EN in de snippet. Kopieën in `theme-snippets/`.
- `sections/main-collection-banner.liquid`: vertrouwensbalk (gratis verzending vanaf €60 NL/DE/CH/PL of €75 BE, anders weggelaten · verzonden binnen 1–3 werkdagen · 100% originele merken · "Twijfel je? Probeer eerst een sample"), beschrijving op mobiel 3 regels + "Lees meer". CSS in `assets/maison-apps.css` (blok "Conversie").
- Geurwijzer-data: 28 nieuwe geuren toegevoegd (giftsets niet) en beschikbaarheidscheck via `paginate collections.all.products by 250` (zonder paginate maar 50 producten → nieuwe producten vielen weg).
- 30 nieuwe producten (5/6 okt, o.a. Bade'e Al Oud-lijn, Jean Lowe, Mykonos, Asad Bourbon/Elixir, Teriaq, Angham) hadden al NL-tekst, SEO en collecties (door ander gesprek); nu ook DE/FR/EN (body, SEO-titel, SEO-omschrijving) geregistreerd. Titels niet vertaald (merknamen).
- Alle handmatige collecties opnieuw gesorteerd: grote fles op voorraad eerst (voorraad aflopend, afgetopt op 50), dan alleen sample op voorraad, dan uitverkocht.
- Let op voorraad: bij veel nieuwe producten heeft de 100ml-variant 0 voorraad en alleen de Sample voorraad (Syncee). Kaarten tonen dat nu eerlijk.

## v11 (7 okt 2026) – knop-vangnet + Hoppy-embed uit
- Eigenaar stuurde screenshot van productpagina met onleesbare "Aan winkelwagen toevoegen" en Engelse Hoppy-widget ("You're only €30,05 away…" + productcarrousel). Live v10 had beide fixes al → waarschijnlijk oude preview/cache in de browser. Toch zekerheidshalve:
- **v11 (knop + Hoppy uit)** ID 210674352477 = v10 + `config/settings_data.json`: Hoppy app-embed `disabled: true` (balk én productpagina-widget weg; de Hoppy-korting in de kassa is een Shopify-korting en blijft werken) + `assets/maison-apps.css` vangnet: `.product-form__submit` altijd zwart met ivoren tekst. **Door eigenaar gepubliceerd 7 okt (gecontroleerd 8 okt: alle bestanden kloppen, kortingen actief).** Toekomstige themawijzigingen op een kopie van v11.

## Open punten
1. **Overstap Fragra → Luxus Aroma** (zie `OVERDRACHT.md` voor de productlijst):
   - (Fragra gestopt: alle 14 zijn gearchiveerd; zo snel mogelijk via Luxus importeren.) Producten 1–8 nu overzetten, met Sample-variant (€14,95, SKU `<EAN>-SAMPLE`). Prijs 100ml niet aanpassen.
   - Producten 9–14 pas overzetten als Luxus weer voorraad heeft.
   - Eerst in Syncee uitzoeken: kan een bestaand product op SKU/EAN gekoppeld worden (route B) of moet er nieuw geïmporteerd worden en het oude gearchiveerd (route A)?
   - Syncee-UI was lastig via Chrome te bedienen ("Setup guide"-venster blokkeerde klikken).
2. Hoppy Free Shipping: balk verborgen in v10. In de app nog regelen: gratis cadeau ≥ €100 (verwijst naar verwijderde variant) + gratis verzending ≥ €60 ook voor BE.
3. Klaviyo Customer Agent: nog niet geactiveerd. Na activatie kennisbank vullen.
4. ~~iDEAL~~ werkt via Mollie. Wel nog: Bancontact voor België controleren/aanzetten.
5. Nieuwe producten komen niet vanzelf in de Geurwijzer-data: handmatig toevoegen.
6. 31 producten hebben maar 1 foto: extra beelden nodig (eigenaar/leverancier).
7. EAN ontbreekt op 100ml-variant van 7 producten (Khamrah Waha, Musamam Black Intense, Hawas Malibu, Hawas Fire, Vulcan Baie, Ana Abiyedh Rouge, Como Moiselle): opzoeken in Syncee.
8. 15 thema's (max 20): oude thema's kan alleen de eigenaar verwijderen.
9. Oudere SEO-teksten (±37 producten) noemen designer-parfums ("in de sfeer van …"): merkenrechtelijk risico, eventueel herschrijven.
