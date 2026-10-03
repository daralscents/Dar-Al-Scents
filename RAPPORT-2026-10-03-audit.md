# Website-audit Dar Al Scents – 3 okt 2026 (middag)

Volledige controle via de Admin API (de winkel zelf was vanuit Claude niet te openen). Thema-wijzigingen staan in de **niet-gepubliceerde kopie v6** (`Dar Al Scents – premium v6 (geurwijzer fix 3 okt)`, ID 210579685725). De eigenaar moet v6 publiceren.

## Gevonden en opgelost

### Producten
- 3 nieuwe Syncee-producten stonden online zonder collectie, SEO en vertaling: **Lattafa Eclaire Banoffi EDP**, **Rayhaan Elixir EDP**, **Afnan 9PM Night Out Extrait de Parfum**.
  - Titels gestandaardiseerd (handles ongewijzigd), producttype Banoffi ("Beauty, Perfumes and fragrances" → Eau de Parfum), SEO-titel/omschrijving, alt-teksten (15 foto's), DE/FR/EN-vertalingen (titel, beschrijving, SEO).
  - Toegevoegd aan Dames, Heren, Unisex, Winter Heren en Winter Dames (unisex in beide, zoals afgesproken).
  - Toegevoegd aan de Geurwijzer-data in v6.

### Collecties
- **TikTok Favorieten**: 2 uitverkochte → 9 producten, eerste 4 op voorraad (Khamrah Waha, Eclaire Pistache, Club de Nuit Intense, Hawas Ice). Collectieafbeelding → Khamrah Waha.
- **Bestsellers**: de 8 op de homepage zijn nu allemaal op voorraad (Khamrah Waha, Riiffs Freeze, Hawas Reina toegevoegd; uitverkochte achteraan).
- Dames/Heren/Unisex/Winter Heren/Winter Dames opnieuw gesorteerd (voorraad eerst).
- SEO-teksten die gearchiveerde producten noemden herschreven (+ DE/FR/EN): Speciale Editie, Zomer Dames, Bundel Gourmand.

### Thema v6
- **B2B-pagina** had door de Shopify-thema-update zijn eigen opmaak verloren (titel dubbel) → `main-page-b2b` hersteld.
- **Reviews-pagina** had geen template → toonde de "Over ons"-inhoud in plaats van de Judge.me-reviews. `templates/page.reviews.json` aangemaakt.
- **Collectiepagina's** (algemeen, Heren, Dames, Unisex):
  - "Uitgelicht product" verwees op Dames en Unisex naar verwijderde producten (lege blokken) → Hawas Reina (Dames), Riiffs Freeze (Unisex), Club de Nuit Intense (Heren), Hawas Ice (algemeen).
  - Promoblokken voor Ana Abiyedh / Lattafa Eclaire / Momento (verwijderd, gearchiveerd of uitverkocht) uitgezet.
  - Badge "Best Seller – 1,000+ sold this month!" op Dames uitgezet: klopt niet met de werkelijke verkoop (misleidend).
- Merkteksten bijgewerkt naar wat er echt verkocht wordt (Faris, Nusuk, Maison Alhambra eruit), incl. DE/FR/EN: hero, merkenband, "Over Dar Al Scents"-blok, tab "Originaliteit" op productpagina, chat-assistent.
- Titel collectie-overzicht "Collections" → "Collecties".

### Links / SEO
- **94 doorverwijzingen** (301) aangemaakt: oude links naar verdwenen/gearchiveerde producten gaan naar het vervangende product of de juiste collectie (lijst: `backups/2026-10-03-redirects.json`).
- Lege pagina's Heren/Dames/Unisex Parfum (toonden "Over ons"-inhoud) verborgen en doorgestuurd naar de collecties.

## Belangrijk om te weten
- **De 57 Fragra-producten zijn niet gearchiveerd maar volledig verwijderd** uit Shopify (niet door Claude). Totaal nu 72 producten: 38 actief, 34 gearchiveerd. Back-up van de oude gegevens: `backups/2026-10-03-producten-voor-opschoning.json`.
- Er wordt op dit moment ook vanuit een ander gesprek/proces aan producten gewerkt (nieuwe producten en foto's om ±15:16–16:15).

## Moet de eigenaar zelf doen
1. **Thema v6 publiceren** (Webshop → Thema's → v6 → ⋯ → Publiceren). Preview: https://daralscents.nl/?preview_theme_id=210579685725
2. **Wettelijke kennisgeving** (Instellingen → Beleid): staat nog "[vul hier jullie KvK-inschrijving in]" en "[vul hier jullie btw-nummer in]" en "[optioneel invullen…]". Invullen: KvK 93708246, btw NL005039450B89, tel. +31 6 44835315 (gegevens uit eigen contactpagina). Claude heeft hier geen schrijfrechten voor.
3. **Postcode klopt niet overal**: contact/privacy zeggen 2727 ET, wettelijke kennisgeving/retour/voorwaarden zeggen 2724SL. Eén juiste postcode kiezen.
4. **E-mailadressen**: daralscents@gmail.com én info@daralscents.nl worden door elkaar gebruikt; controleren of info@ werkt.
5. **"Over ons"-pagina** (`templates/page.json`, door eigenaar gemaakt) noemt nog Faris en Nusuk, en "geïnspireerd door bekende designergeuren". **B2B-pagina** noemt ook nog Faris/Nusuk. Aanpassen via Pagina's / thema-editor.
6. Samples: bij de 3 nieuwe producten kost de 3ml-variant €14,95, bij de rest €15,95 (Syncee). Prijzen niet door Claude aangepast.
7. Nog steeds open: iDEAL, Hoppy-teksten Engels, Klaviyo-agent, EAN's, extra productfoto's.
