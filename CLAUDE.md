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

## Conversie-analyse 8 okt 2026 – zie `RAPPORT-2026-10-08-conversie.md`
- Echte conversie ±0,06% (1 webshop-order in 14 dagen; #1005–#1011 zijn conceptorders). België mobiel: 95% bounce, 7 sec. Probleem zit in verkeer/aansluiting video→pagina, reviews (1 in hele winkel), voorraad, Bancontact.
- Redirects aangepast: oude Angham Second Song-URL (TikTok, 250 sessies) → nieuw product `lattafa-angham-second-song-edp`; oude Honor & Glory-URL → `lattafa-badee-al-oud-honor-glory-edp`.

## Samplepakket, kortingen, review-mail + thema v12 (8 okt 2026)
- Verzendkortingen (door eigenaar aangepast 8 okt): **NL gratis ≥ €50**, **BE ≥ €60**, DE/PL/CH ≥ €60. Hoppy app-korting (2303479677277) door Claude **gedeactiveerd** (akkoord eigenaar).
- **WELKOM10** (10%, 1× per klant, combineert met verzending) aangemaakt: stond al in 3 Klaviyo-mails maar bestond niet.
- **REVIEW10** (zelfde instellingen) = beloning voor een review.
- **Samplepakket**: automatische korting "Samplepakket: 3 samples voor €25" (DiscountAutomaticNode/2306581266781): 47,75% op 64 sample-varianten bij min. 3 stuks (3 × €15,95 → €24,99). **Nieuwe producten: sample-variant handmatig aan deze korting toevoegen.** Smart collectie `samplepakket` (727700996445, regel varianttitel = Sample) + menu-item "Samples: 3 voor €25" (beide vertaald DE/FR/EN).
- Klaviyo post-aankoop e-mail 2 (flow TSMJ8P, actie 118153045): nieuwe template met REVIEW10-code, onderwerp "Hoe bevalt je nieuwe geur? (+10% voor jou)". Klaviyo kopieert de template bij koppeling (flow-template UD4tL5; bron VnHLSB). Flow-templates kun je niet via `update_email_template` wijzigen (404) → nieuwe template maken en flow-actie omhangen.
- Klaviyo-afzender nog `daralscents@gmail.com` (niet aangepast: info@daralscents.nl is niet als afzender/sending domain geverifieerd). Geen aanmeldformulier → welkomstflow start nooit.
- **Thema v12 (verzending + samples)** ID 210713051485 = v11 + verzendbedragen €50/€60 overal (aankondigingsbalk, collectiebanner, winkelmand-balk NL 5000/anders 6000, productpagina-tab, chat-assistent, homepage hero/USP, `maison-t` trust_free) + samplepakket-promo (aankondiging, hero-knop 2, regel in collectiebanner, regel in `maison-pdp-trust` bij producten met sample, hint in winkelmand bij 1–2 samples / "korting toegepast"). Thema-vertalingen DE/FR/EN geregistreerd. Kopieën in `theme-snippets/*.v12.liquid`. **Eigenaar moet v12 publiceren.**
- Verzendbeleid (`/policies/shipping-policy`) kan Claude niet schrijven: eigenaar moet bedragen daar zelf aanpassen.

## Merkcollecties + pop-up (8 okt 2026, avond)
- 10 smart collecties op leverancier (VENDOR): `lattafa-parfum` (STARTS_WITH "Lattafa", incl. Lattafa Pride), `french-avenue-parfum`, `rasasi-parfum`, `armaf-parfum`, `maison-alhambra-parfum`, `afnan-parfum`, `riiffs-parfum`, `mykonos-parfum`, `rayhaan-parfum`, `khadlaj-parfum` (IDs 727717773661 … 727718068573). NL-tekst + SEO, DE/FR/EN vertaald, gepubliceerd op Webshop/Shop/TikTok/Google/Facebook. Handmatige sortering: grote fles op voorraad → alleen sample → uitverkocht (statisch: bij nieuwe voorraad opnieuw sorteren; nieuwe producten komen onderaan). Emper/Nusuk (1 product) geen collectie.
- Hoofdmenu: "Merken" (Marken/Marques/Brands) met de 10 merken, na "Parfum".
- Klaviyo-pop-up **"Pop-up WELKOM10 (10% eerste bestelling)"** (form TrJ5jq) als **concept**: na 8 sec of exit-intent, 7 dagen pauze na sluiten, aanmelding op Email List TFJL6r (dubbele opt-in → welkomstflow start pas na bevestiging), bedankstap toont WELKOM10 + knop naar samplepakket. Alleen NL-tekst. **Eigenaar moet hem in Klaviyo live zetten** (API kan alleen concepten maken).
- Let op: 2 conceptproducten met Spaanse variantnamen ("Frasco Original 100ml", "Muestra 5 ml") in Lattafa/French Avenue (Syncee-import?), niet zichtbaar zolang concept.
- Klantmail na aankoop: Judge.me stuurt eigen review-verzoek (dag 14, standaard groene opmaak) naast Klaviyo review-mail (dag 12). Advies: één van beide; Judge.me-opmaak aanpassen in de app (eigenaar).

## Verlaten winkelwagen: unieke codes + Google-feed (9 okt 2026)
- Shopify-korting **"Verlaten winkelwagen 10% (Klaviyo, unieke codes)"** (DiscountCodeNode/2306777383261): 10% op alles, 1× per klant, combineert alleen met verzendkorting, 300 unieke codes `DAS` + 7 tekens.
- Klaviyo-coupon **VERLATEN10** (uploaded, alarm bij < 100 over) met dezelfde 300 codes. Templates gebruiken `{% coupon_code 'VERLATEN10' %}`. **Bijna op → nieuwe codes in Shopify (`discountRedeemCodeBulkAdd`) én Klaviyo (`bulk_create_coupon_codes`) toevoegen.**
- Flow "Verlaten winkelwagen" (Vf85R5): mail 1 (1 u) ongewijzigd zonder korting; mail 2 (24 u) en mail 3 (72 u) nu met persoonlijke unieke code (templates TH3LNT / XCZPfM, flow-kopieën UpgjEK / Wuceqh). WELKOM10 + onterechte "48 uur geldig" eruit. Mail 2 en 3 geven elk een eigen code; Shopify staat maar 1 gebruik per klant toe.
- Google-feed: alle 70 actieve producten staan op het Google & YouTube-kanaal, alle grote flessen hebben een EAN. 40 producten zonder (juiste) Shopify-categorie kregen categorie Eaux de parfum / Parfum extracten / Parfum sample en ontdekking set / Parfums en colognes. Sample-varianten hebben geen EAN (Google kan ze beperken). Verdachte EAN's: Rasasi Hawas Fire (6921699090254) en Hawas Eclat (7771325846514) – controleren bij leverancier.

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

## Contact-e-mail gelijkgetrokken + thema v15 (14 okt 2026)
- **Werkwijze thema's (eigenaar, 14 okt): geen nieuwe kopie per wijziging.** Altijd het bovenste niet-gepubliceerde thema onder het live thema bijwerken (= live + nieuwe wijziging), tenzij de eigenaar anders zegt. Nu: **v15 "Dar Al Scents – v15 (contact e-mail)" ID 210893996381** (kopie van live v14 210797101405).
- v15: `templates/page.contact.json` → `info.daralscents@gmail.com` vervangen door klikbaar `daralscents@gmail.com` (+ DE/FR/EN-vertaling). Kopie in `theme-snippets/page.contact.v15.json`. **v15 door eigenaar gepubliceerd (gecontroleerd 17 okt: identiek aan v14 behalve page.contact.json; vertalingen DE/FR/EN actueel).** Bovenste niet-gepubliceerde thema is nu v14 (210797101405) → volgende themawijzigingen daar (eerst gelijk trekken met live v15: page.contact.json).
- Klantadres = **daralscents@gmail.com**; zakelijk = daralscents.zakelijk@gmail.com (B2B, laten staan). `info@daralscents.nl` niet meer gebruiken. Adres: Lammerweide 11, **2727 ET** Zoetermeer.
- Klaviyo: reply-to van alle 10 live flow-mails naar daralscents@gmail.com. Standaard-afzender in Klaviyo-account staat nog op info@daralscents.nl (alleen in Klaviyo-instellingen te wijzigen).
- Beleid: Claude heeft geen `write_legal_policies`. Kant-en-klare HTML in `beleid-2026-10-14/` (wettelijke kennisgeving, retour, verzending, voorwaarden, contact) → eigenaar plakt zelf. Back-up oud: `backups/2026-10-14-policies-voor-emailfix.json`.

## Controle na publicatie v15 (17 okt 2026)
- Syncee had 4 nieuwe producten (14 okt: Lattafa Fahad, Riiffs Prive Rose, Rayhaan Obsidian, Volare Esta Fleur; 8 varianten) weer in profiel "Luxus Aroma" gezet → dubbele verzendkosten. Teruggezet naar Algemeen profiel; Luxus-profiel 0 varianten; draftOrderCalculate NL/BE/DE = €4,95. **Na elke Syncee-import: profiel Luxus Aroma (150926197085) controleren.**
- Samples van die 4 producten toegevoegd aan korting "Samplepakket: 3 samples voor €25" (nu 68 varianten).
- 9 verouderde thema-vertalingen ("Bekijk ook" op Dames/Heren/Unisex) ververst.
- Beleidsteksten nog NIET geplakt door eigenaar (nog info@daralscents.nl / 2724SL / oude verzendbedragen). Klaviyo reply-to OK.
- **Thema v16 "Dar Al Scents – v16 (geurwijzer 17 okt)" ID 210797101405** (= oude v14, nu bijgewerkt tot live v15 + Geurwijzer): page.contact.json gelijk aan v15 (+ vertalingen), Geurwijzer-data +8 geuren (Bade'e Al Oud Sublime, Yara, Yara Moi, Ard Al Zaafaran Ana Abiyedh, Fahad, Prive Rose, Obsidian, Esta Fleur); alle 73 actieve parfums (excl. giftsets/bezorggarantie) staan nu in de data. Kopie `theme-snippets/maison-geurwijzer-data.v16.liquid`. **Eigenaar moet v16 publiceren.**
- Beleid opnieuw geprobeerd 17 okt (eigenaar gaf toestemming): nog steeds geen `write_legal_policies` → eigenaar moet plakken of de connector-rechten uitbreiden. Klaviyo-standaardafzender: geen API, alleen in Klaviyo-instellingen.

## Black Friday 2026 (20 okt 2026) – actie 27–30 nov
- Marge-analyse: grote flessen €2–10 winst (vaak verlies bij 20%); samples €8–10 → actie gebouwd rond samples. Akkoord eigenaar.
- **Kortingen (gepland, starten automatisch 27 nov 00:00, eindigen 30 nov 23:59 NL-tijd)**, combineren met verzendkortingen en met elkaar, NIET met codes (WELKOM10 e.d. zijn ORDER-klasse en niet combineerbaar met productkortingen):
  - "Black Friday: 5 samples voor €39,88 (50%)" DiscountAutomaticNode/2309245960541 – 50% op 68 sample-varianten, min. 5 stuks.
  - "Black Friday: gratis sample bij je fles" DiscountAutomaticNode/2309246189917 (BXGY) – koop 1 grote fles → 1 sample 100% gratis, 1× per order. Uitgesloten (te kleine marge): Hawas Tropical, Hawas Eclat, CDN Intense Man, Chronicles, Hawas Reina, Riiffs Liquid Gold, Riiffs Freeze. Zelfde lijst staat in `snippets/maison-bf-gift.liquid`.
  - "Black Friday: 10% op de BF-selectie" DiscountAutomaticNode/2309245796701 – grote fles van Amethyst, Oud for Glory, Fakhar Platinum, Fakhar Femme, Hawas Ice, CDN Overdose, Emper Shinning City, Ard Al Zaafaran.
- Collectie **black-friday** (728135598429, handmatig, 8 producten), NL + DE/FR/EN, gepubliceerd op alle kanalen.
- **Thema "Dar Al Scents – Black Friday 2026 (27–30 nov)" ID 211058753885** = v16 + `sections/maison-bf-head.liquid` (header-group: tijdsturing html.das-bf-pre/live/post, zwart-gouden aankondigingsbalk), `sections/maison-bf-hero.liquid` (homepage bovenaan: aftelklok, 3 deals, 3 producten met BF-prijs), `bf_deals` (maison-products, collectie black-friday), hero_main uit, aankondiging "BLACK FRIDAY 27–30 nov …", `snippets/maison-bf-t.liquid` (teksten 4 talen), `maison-bf-gift`, `maison-bf-cart` (in cart-drawer: kies gratis sample / nog X samples voor 50%), BF-regels in `maison-pdp-trust` en `maison-card-price` (alleen tijdens actie zichtbaar). Kopieën in `theme-snippets/black-friday-2026/`. **Eigenaar publiceert op 26/27 nov en zet na 30 nov v16 (of opvolger) terug.**
- Kortingen kunnen pas vanaf 27 nov getest worden (draftOrderCalculate) – dan controleren.

## Kerst 2026 (20 okt 2026) – thema 1–24 dec
- Geen extra kerstkorting (marges te dun; kerst verkoopt op cadeau + levertijd). Bestaande acties blijven: 3 samples voor €25, gratis verzending €50/€60.
- Nieuwe collectie **cadeaus-onder-30** (728135827805, handmatig, 14 flessen ≤ €30 met voorraad), NL + DE/FR/EN, alle kanalen. Giftsets via bestaande collectie `giftset` (3 sets).
- **Thema "Dar Al Scents – Kerst 2026 (1–24 dec)" ID 211058950493** = v16 + `sections/maison-x-head.liquid` (header-group: fases html.das-x-ontime/late/post, groen-gouden aankondigingsbalk; **besteldeadline 18 dec 23:59**), `sections/maison-x-hero.liquid` (diepgroen/goud: titel, aftelklok tot deadline, cadeaugids met 5 tegels: voor haar, voor hem, onder €30, giftsets, 3 samples €25), `x_sets` (giftset) + `x_under30` op homepage, hero_main uit, aankondigingen "Kerst: bestel vóór 18 december…" + "Cadeautje erbij? 3 samples €25", deadline-regel in `maison-pdp-trust` en winkelmand (`snippets/maison-x-note.liquid`), teksten `maison-x-t` (4 talen). Kopieën in `theme-snippets/kerst-2026/`.
- Deadline wijzigen: `maison-x-head` (DEADLINE in JS) + `maison-x-t` sleutel 'deadline' + aankondigingstekst (+ vertalingen). **Eigenaar: deadline checken bij leverancier (Luxus Aroma/Syncee levertijd).**
- Let op: bij het bouwen eerst per ongeluk een oude header-group/pdp-trust als basis gebruikt; hersteld en gecontroleerd (beide thema's bevatten nu de v16-teksten). Les: basisbestanden altijd vers ophalen uit het bronthema, niet uit het transcript.

## Sfeer door de hele webshop (21 okt 2026) – BF- en Kerst-thema
- **BF-thema (211058753885)**: `maison-bf-head` bevat nu CSS voor de hele site (alleen vóór/tijdens de actie): gouden lijn onder de header, zwarte collectiebanners met gouden lijn, goud bij hover op productkaarten, gouden footerrand, winkelmand-kop "· Black Friday", donkere homepage-secties (behalve de zandkleurige secties en de nieuwsbrief). Nieuwe sectie `maison-bf-strip` (header-group, niet op de homepage): zwarte strook met aftelklok → /collections/black-friday. Productkaarten tonen tijdens de actie "+ gratis sample (t.w.v. €15,95)" (sleutel `card_gift` in `maison-bf-t`, regels uit `maison-bf-gift`).
- **Kerst-thema (211058950493)**: `maison-x-head` met CSS voor de hele site: groene collectiebanners en footer met goud, goud bij hover op kaarten, gouden scheidingslijnen tussen secties, groene knoppen en marquee. Nieuwe sectie `maison-x-strip` (niet op de homepage): groene strook met aftelklok tot de besteldeadline → /collections/giftset. Kaarten in giftset/cadeaus-onder-30 tonen "Cadeautip" (`card_tip` in `maison-x-t`).
- Kopieën in `theme-snippets/black-friday-2026/` en `kerst-2026/`. Weergave niet te controleren vanuit de container → eigenaar moet het visueel nakijken via de preview.
- **Productpagina netter (21 okt, beide seizoensthema's)**: nieuw `snippets/maison-pdp-style.liquid` (CSS alleen op productpagina's: prijs groter, strakke maatknoppen met zwarte selectie, aantal + knop strak, rustige tabbladen/delen, galerij-thumbnails zand, "Misschien vind je dit ook mooi" in catalogustegels). `maison-pdp-trust` herschreven: seizoenskaart bovenaan (BF: zwart/goud met aftelklok en de deals die voor dit product gelden; Kerst: groen/goud met besteldeadline + aftelklok, label "Cadeautip" bij giftset/onder €30), samplepakket als zandkleurige kaart, 3 pictogrammen (verzending, bedenktijd, origineel), verzendregel, WhatsApp. `templates/product.json`: gerelateerde producten vierkant, zonder sterren, kop h2. Kan ook naar v16 (zonder seizoenskaart) als eigenaar dat wil.
- **Kerst rustiger (22 okt, eigenaar: "teveel chaos in het groene gedeelte")**: productpagina-kerstblok nu alleen label (Kerst 2026 / Cadeautip) + één zin over de besteldeadline, zonder aftelklok/lijst/link (`.m-pdp-xmas` in `maison-pdp-trust`). Collectiebanner gecentreerd, beschrijving max. 2 regels + "Lees meer", vertrouwensregel als één stille rij met scheidingsstreepjes, sample-link eruit (CSS in `maison-x-head`). Groene strook niet meer op collectiepagina's (`maison-x-strip`), alleen nog op product- en overige pagina's.
- **Kerst meer door de pagina, nette opbouw (22 okt, eigenaar)**: nieuw `snippets/maison-x-guide.liquid` = groene cadeaugids-band (links kop "Geef een geur die blijft" + besteldeadline met aftelklok, rechts gelijke tegels Voor haar / Voor hem / Onder €30 / Giftsets / 3 samples €25; huidige collectie wordt overgeslagen). Als sectie `x_guide` (custom-liquid) direct onder het productgrid in `collection.json` + dames/heren/unisex-templates, en onderaan `product.json`. Collectiebanner (`main-collection-banner`, alleen Kerst-thema): label "Kerst 2026" boven de titel + rij korte cadeaulinks onder de vertrouwensregel (CSS `.m-xb__*` in `maison-x-head`). Alles verdwijnt na kerst.
