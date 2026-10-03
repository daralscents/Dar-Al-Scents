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
- Live thema: **"Dar Al Scents – premium v4 (claude code final)"** (Dawn 15.4.0-basis, eigen "Maison"-stijl: ivoor, zwart, goud; Cormorant + Jost).
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
- Vervanging: zoveel mogelijk via Luxus Aroma (of andere leverancier) in Syncee importeren.

## Open punten
1. **Overstap Fragra → Luxus Aroma** (zie `OVERDRACHT.md` voor de productlijst):
   - (Fragra gestopt: alle 14 zijn gearchiveerd; zo snel mogelijk via Luxus importeren.) Producten 1–8 nu overzetten, met Sample-variant (€14,95, SKU `<EAN>-SAMPLE`). Prijs 100ml niet aanpassen.
   - Producten 9–14 pas overzetten als Luxus weer voorraad heeft.
   - Eerst in Syncee uitzoeken: kan een bestaand product op SKU/EAN gekoppeld worden (route B) of moet er nieuw geïmporteerd worden en het oude gearchiveerd (route A)?
   - Syncee-UI was lastig via Chrome te bedienen ("Setup guide"-venster blokkeerde klikken).
2. Hoppy Free Shipping: klantteksten nog Engels ("You're only … away from free shipping!"). Aanpassen in de app zelf.
3. Klaviyo Customer Agent: nog niet geactiveerd. Na activatie kennisbank vullen.
4. iDEAL staat niet aan bij de betaalmethoden: eigenaar laten controleren.
5. Nieuwe producten komen niet vanzelf in de Geurwijzer-data: handmatig toevoegen.
6. 31 producten hebben maar 1 foto: extra beelden nodig (eigenaar/leverancier).
7. EAN ontbreekt op 100ml-variant van 7 producten (Khamrah Waha, Musamam Black Intense, Hawas Malibu, Hawas Fire, Vulcan Baie, Ana Abiyedh Rouge, Como Moiselle): opzoeken in Syncee.
8. 15 thema's (max 20): oude thema's kan alleen de eigenaar verwijderen.
9. Oudere SEO-teksten (±37 producten) noemen designer-parfums ("in de sfeer van …"): merkenrechtelijk risico, eventueel herschrijven.
