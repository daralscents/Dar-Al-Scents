# Dar Al Scents – intern bedrijfsdashboard

Een interne webapplicatie voor de administratie van Dar Al Scents:

- producten en prijslijst, leveranciers en inkoopprijzen;
- inkooporders, voorraad, verkopen, retouren en betalingen;
- uitgaven, overige inkomsten en financiering;
- marketing, rapporten en CSV-import/-export.

De interface is volledig Nederlands. Bedragen staan in euro, datums als dd-mm-jjjj.

De app draait lokaal (of op een eigen server) en slaat alles op in één SQLite-database. **Je echte administratie begint leeg.** Voorbeeldgegevens staan alleen in een aparte demo-database.

## Snel starten

Vereist: **Node.js 22.13 of nieuwer** (de app gebruikt de ingebouwde `node:sqlite`; geen databaseserver nodig).

```bash
cd dashboard
npm install
cp .env.example .env            # pas desgewenst poort/mappen aan
npm run create-user -- --email jij@daralscents.nl --name "Jouw naam" --role admin
npm start                        # → http://127.0.0.1:3000
```

`create-user` vraagt het wachtwoord in de terminal (minimaal 10 tekens). Bij automatisering kan dat ook via de omgevingsvariabele `NEW_USER_PASSWORD`.

Rollen:

- **Beheerder**: mag alles.
- **Alleen lezen**: kan alles bekijken en exporteren, maar niets wijzigen.

Extra gebruikers maak je aan via *Instellingen → Gebruikers*.

Database-migraties draaien automatisch bij het starten. Handmatig kan het ook: `npm run migrate`.

### Demo-omgeving (optioneel)

```bash
npm run seed:demo    # maakt demo-data/dar-al-scents-demo.sqlite opnieuw aan
npm run demo         # → http://127.0.0.1:3001, inlog demo@voorbeeld.nl / demo-wachtwoord
```

De demo heeft een eigen database in `demo-data/` en toont bovenaan een balk “Demo-omgeving”. Alle namen beginnen met DEMO. De echte database in `data/` wordt nooit aangeraakt.

## Wat zit erin

| Onderdeel | Belangrijkste functies |
|---|---|
| **Overzicht** | KPI’s per periode: vandaag, week, maand, kwartaal, jaar of eigen bereik. Elke KPI is klikbaar en toont uitleg, berekening, onderliggende regels en een CSV-export. Grafiek van omzet en kosten, omzet per kanaal, kosten per categorie, bestverkochte producten en recente transacties. |
| **Producten** | Producten met varianten: SKU, inhoud, uitvoering, prijs incl. btw, btw-tarief en minimale voorraad. Productfoto, archiveren, zoeken en filteren. **Prijslijst** met live marge-berekening en prijshistorie. |
| **Leveranciers** | Contactgegevens, inkoopprijzen per variant (valuta, MOQ, levertijd), voorkeursleverancier, prijshistorie, bestedingen en openstaande bedragen. |
| **Inkoop** | Inkooporders: concept, besteld, gedeeltelijk ontvangen, ontvangen, geannuleerd. Vreemde valuta met vastgelegde wisselkoers. Verzend-, invoer- en overige kosten worden verdeeld naar waarde of aantal (landed cost). Gedeeltelijke ontvangsten en betalingen. |
| **Voorraad** | Mutatieregister (beginvoorraad, inkoop, verkoop, retour, beschadiging, weggegeven, correctie) met reden en gebruiker. Gewogen gemiddelde kostprijs, lage-voorraadsignaal en voorraadwaarde op een peildatum. |
| **Verkopen** | Kanaal, betaalmethode, campagne, klanttype en marketingbron. Kortingen in € of %. Aparte statussen voor order, uitlevering en betaling. Retouren (wel of niet terug op voorraad) en terugbetalingen. Overige inkomsten en financiering staan apart. |
| **Uitgaven** | Categorieën (inclusief marketingcategorieën), factuur of bon als bijlage (PDF, PNG, JPG of WEBP; de inhoud wordt gecontroleerd), vervaldatum, gedeeltelijke betalingen en koppeling aan een campagne of marketingkanaal. |
| **Marketing** | Kosten en omzet per campagne en per kanaal. ROAS en CAC alleen waar de gegevens dat betrouwbaar toelaten (zie definities). |
| **Rapporten** | Maandoverzicht, productprestaties, omzet per kanaal, uitgaven, inkoop per leverancier, voorraadwaardering, openstaande posten, betalingen en btw. Allemaal met CSV-export. |
| **Importeren** | CSV voor producten (incl. beginvoorraad), leveranciers en verkopen. Stappen: kolommen koppelen, preview met fouten per regel, daarna pas bevestigen. Hetzelfde bestand kan niet twee keer worden verwerkt; bestaande SKU’s, leveranciers en ordernummers worden overgeslagen. |
| **Instellingen** | Bedrijfsgegevens, btw-tarieven, standaard minimale voorraad, keuzelijsten (categorieën, kanalen, betaalmethoden), gebruikers, wachtwoord, back-up en auditlog. |

## Definities (zoals de app rekent)

Alle bedragen worden opgeslagen als **gehele centen**. Er is dus geen afrondingsdrift door kommagetallen.

- **Btw**:
  - Opgeslagen als basispunten (2100 = 21%).
  - Verkoopprijzen zijn incl. btw. Per regel geldt: netto = round(bruto × 10000 / (10000 + tarief)) en btw = bruto − netto, zodat het altijd exact optelt.
  - Bij inkoop en uitgaven is btw standaard terugvorderbaar (voorbelasting) en telt dan niet mee als kosten. Is ze niet terugvorderbaar, dan hoort ze bij de kostprijs of de kosten. Dit stel je in per inkooporder of uitgave, met een standaard in Instellingen.
- **Netto-omzet (excl. btw)**:
  - Netto regelbedragen (na korting) plus netto verzendopbrengst, van verkopen die in de periode zijn **uitgeleverd**, min netto retourbedragen op de retourdatum.
  - Niet-uitgeleverde orders, overige inkomsten, leningen en privéstortingen tellen niet mee.
- **Kostprijs verkopen (COGS)**:
  - Wordt bij uitlevering vastgelegd tegen het **gewogen gemiddelde** van de voorraad op dat moment.
  - Bij een retour die terug op voorraad gaat, komt het evenredige deel terug.
- **Brutowinst** = netto-omzet − COGS. **Brutomarge** = brutowinst / netto-omzet.
- **Operationeel resultaat** = brutowinst − bedrijfskosten (uitgaven excl. terugvorderbare btw) − voorraadafboekingen (beschadiging/weggegeven) + overige inkomsten (excl. btw).
  - Inkoop telt hier **niet** als kosten: die wordt pas kosten via de COGS bij verkoop. Zo is er geen dubbeltelling.
- **Kasstroom** = alle betalingen (niet vervallen) met betaaldatum in de periode, in min uit.
  - Inkoopbetalingen tellen hier wél mee.
  - Financiering (lening, privéstorting/-opname) wordt apart getoond.
- **Voorraadwaarde**: som van alle voorraadmutaties tot de peildatum.
  - Een inkoopontvangst krijgt de goederenwaarde in EUR (tegen de koers van de order) plus het toegerekende deel van de extra kosten.
- **Openstaand**:
  - Debiteuren: verkopen min ontvangen min terugbetaald.
  - Crediteuren: inkooporders en uitgaven min betaald.
  - Altijd per vandaag.
- **ROAS** = omzet die aan een campagne of kanaal is toegewezen / marketingkosten van die campagne of dat kanaal.
  - Wordt alleen getoond als **beide** bekend zijn.
- **CAC** = marketingkosten / aantal nieuwe klanten.
  - Wordt alleen berekend als bij de verkopen het klanttype is ingevuld. Ontbreekt dat, dan meldt de app welke gegevens missen in plaats van een getal te verzinnen.

## Betrouwbaarheid en veiligheid

- **Validatie aan de serverkant** van alle invoer, met duidelijke Nederlandse foutmeldingen bij het veld.
- **Transacties**: elke boeking (bijv. verkoop + voorraad + betaling) slaagt helemaal of helemaal niet.
- **Dubbele invoer voorkomen**:
  - Elk formulier heeft een unieke verwerkingssleutel, dus dubbelklikken of opnieuw verzenden boekt niets dubbel.
  - Voert iemand binnen 10 minuten een inhoudelijk identieke verkoop of uitgave in (bijv. na “terug” in de browser), dan vraagt de app eerst om bevestiging. Hetzelfde geldt voor een factuurnummer dat bij dezelfde leverancier al bestaat.
  - Een ontvangst of retour wordt nooit twee keer verwerkt.
  - Betalingen boven het openstaande bedrag worden geweigerd.
- **Geen stille negatieve voorraad**: uitleveren, afboeken of corrigeren onder 0 wordt geweigerd met een melding.
- **Onveranderlijke historie**:
  - Voorraadmutaties, betalingen, ontvangsten, retouren en verkoopregels kunnen in de database niet worden verwijderd of overschreven (database-triggers).
  - Fouten herstel je met een tegenboeking, een vervallen-verklaring met reden, een annulering of archivering.
  - Prijswijzigingen veranderen oude verkopen niet.
- **Beveiliging**:
  - Wachtwoorden met scrypt.
  - Sessiecookie HttpOnly + SameSite, sessies verlopen na 12 uur inactiviteit.
  - CSRF-bescherming op alle formulieren.
  - Rem op inlogpogingen.
  - Strikte Content-Security-Policy.
  - Bijlagen alleen voor ingelogde gebruikers, met controle op het echte bestandstype.
- **Auditlog**: wie wat wanneer heeft gewijzigd (*Instellingen → Auditlog*).

## Back-up en herstel

**Back-up maken** (de app mag blijven draaien):

```bash
npm run backup
```

Dit maakt `backups/backup-<datum-tijd>/` aan, met daarin:

- een consistente kopie van de database (`VACUUM INTO`);
- alle bijlagen;
- een `MANIFEST.txt`.

De integriteit van de kopie wordt gecontroleerd. Dezelfde actie staat onder *Instellingen → Back-up*.

**Advies**: maak dagelijks een back-up (bijv. via een geplande taak) en bewaar een kopie **buiten** deze computer (externe schijf of versleutelde cloudmap). De map `backups/` staat niet in git.

**Herstellen**:

1. Stop de app (Ctrl+C).
2. Herstel de back-up:

   ```bash
   npm run restore -- backups/backup-2026-11-18T11-34-20
   ```

   - De back-up wordt eerst op integriteit gecontroleerd.
   - De huidige database blijft bewaard als `*.voor-herstel-<tijd>`.
   - Daarna worden database en bijlagen teruggezet.
3. Start opnieuw met `npm start`.

## Tests

```bash
npm test               # 23 automatische tests (rekenregels, voorraad, inkoop, verkoop, KPI's, HTTP, beveiliging, import)
npm run test:browser   # 15 browserstappen in Chromium (Playwright), desktop en mobiel
SCREENSHOTS=schermen npm run test:browser   # idem, met schermafbeeldingen
```

De browsertest draait op een tijdelijke lege database en doorloopt deze stappen:

1. Inloggen.
2. Leverancier en product met varianten aanmaken.
3. Inkoopprijs koppelen en beginvoorraad registreren.
4. Inkooporder met deelontvangst en deelbetaling.
5. Verkoop met korting, live totaal, uitlevering en betaling.
6. Dubbele invoer via “terug”.
7. Retour met terugbetaling.
8. Marketinguitgave met PDF-factuur.
9. Prijswijziging (oude verkoop blijft ongewijzigd).
10. CSV-import.
11. KPI-uitsplitsing met CSV-download.
12. 15 pagina’s op een mobiel scherm (390 px), zonder horizontale scroll of afgesneden elementen.
13. Uitloggen.

Voor de browsertest moet Playwright met Chromium beschikbaar zijn (`npm i -D playwright && npx playwright install chromium` als het nog niet geïnstalleerd is).

## Draaien op een server

- Zet `HOST=0.0.0.0` alleen achter een reverse proxy met HTTPS, bijvoorbeeld Caddy of nginx.
- Zet daarbij `COOKIE_SECURE=true` en `TRUST_PROXY=1`.
- Maak de eerste gebruiker aan met `npm run create-user`. Of zet tijdelijk een lange willekeurige `SETUP_TOKEN` en ga naar `/installeren` (de code vul je daar in); dat werkt alleen zolang er nog geen gebruikers zijn. Haal het token daarna weg.
- Geheimen horen alleen in `.env` (staat niet in git).

## Niet gekoppeld (bewust handmatig)

- **Geen automatische koppeling** met Shopify, Syncee, Mollie, de bank of Klaviyo. Verkopen, inkopen en betalingen voer je in of importeer je via CSV. Zo blijft het dashboard de bron voor je eigen cijfers, los van de webshop.
  - Een Shopify-orderexport is via de verkopen-import in te lezen: koppel de kolommen, en het ordernummer voorkomt dubbele import.
- **Geen boekhoudpakket of aangiftemodule.** Het btw-rapport is een hulpmiddel voor de aangifte, geen vervanging ervan; laat de aangifte controleren door je boekhouder. Het dashboard is managementinformatie, geen officiële jaarrekening.
- **E-mail** (wachtwoord vergeten, meldingen) is niet ingebouwd. Een beheerder kan een wachtwoord resetten via *Instellingen → Gebruikers* (de gebruiker wordt dan overal uitgelogd).
- **Meerdere valuta**: inkoop en betalingen kunnen in vreemde valuta met een vastgelegde koers. Rapportage gebeurt altijd in EUR.

## Aannames

- Eén bedrijf, één valuta voor rapportage (EUR). Verkoopprijzen zijn incl. btw (B2C).
- Omzet telt op het moment van **uitlevering**, niet op het moment van bestellen of betalen.
- Kostprijsmethode: gewogen gemiddelde, met extra inkoopkosten opgenomen in de voorraadwaarde.
- Verzendopbrengst telt als omzet, standaard met het algemene btw-tarief (aan te passen in Instellingen).
- Overige inkomsten worden excl. btw ingevoerd. Leningen en privéstortingen zijn geen omzet.
- De periodekeuze gebruikt de Nederlandse tijd (Europe/Amsterdam).
