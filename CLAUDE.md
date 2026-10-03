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
- SEO: alle 90 actieve producten hebben SEO-titel (≤ 60 tekens) en omschrijving. 226 alt-teksten ingevuld.
- Badges van 1505 Watch staan in eigen Shopify-bestanden.
- Producten komen binnen via **Syncee**. Tags: `FRAG` = leverancier Fragra, `LUAR` = leverancier Luxus Aroma.

## Opschoning 3 okt 2026
- 57 producttitels gestandaardiseerd naar `Merk Naam EDP 100ml` (producten met Sample-variant zonder inhoud in de titel). Handles ongewijzigd, Geurwijzer werkt op handles.
- Producttypes genormaliseerd naar Eau de Parfum / Extrait de Parfum / Eau de Toilette / Body mist / Giftset (88 producten). Smart collectie "Sprays" filtert op titel "spray" of type "Body mist".
- Back-up van de situatie vóór de opschoning: `backups/2026-10-03-producten-voor-opschoning.json`.
- Nog te doen: DE/FR/EN titelvertalingen gelijkzetten, collectietitel "Bundel: Day &amp; Night", 3 producten zonder collectie (Liquid Brun EDP, 1505 Watch, Embrace), SEO-omschrijvingen (54 producten, 13 collecties), collectieafbeeldingen, ontbrekende EAN's op 7 producten.

## Open punten
1. **Overstap Fragra → Luxus Aroma** (zie `OVERDRACHT.md` voor de productlijst):
   - Producten 1–8 nu overzetten, met Sample-variant (€14,95, SKU `<EAN>-SAMPLE`). Prijs 100ml niet aanpassen.
   - Producten 9–14 pas overzetten als Luxus weer voorraad heeft.
   - Eerst in Syncee uitzoeken: kan een bestaand product op SKU/EAN gekoppeld worden (route B) of moet er nieuw geïmporteerd worden en het oude gearchiveerd (route A)?
   - Syncee-UI was lastig via Chrome te bedienen ("Setup guide"-venster blokkeerde klikken).
2. Hoppy Free Shipping: klantteksten nog Engels ("You're only … away from free shipping!"). Aanpassen in de app zelf.
3. Klaviyo Customer Agent: nog niet geactiveerd. Na activatie kennisbank vullen.
4. iDEAL staat niet aan bij de betaalmethoden: eigenaar laten controleren.
5. Nieuwe producten komen niet vanzelf in de Geurwijzer-data: handmatig toevoegen.
