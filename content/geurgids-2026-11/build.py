import json
P=lambda h,t:f'<a href="/products/{h}">{t}</a>'
C=lambda h,t:f'<a href="/collections/{h}">{t}</a>'
def card(h,t,txt): return f'<h3>{P(h,t)}</h3><p>{txt}</p>'
SAMPLE='<p><strong>Twijfel je tussen een paar geuren?</strong> Bijna al onze parfums zijn ook verkrijgbaar als sample van 3 ml. Kies er drie en je betaalt samen €25 in ons '+C('samplepakket','samplepakket')+'. Zo test je eerst op je eigen huid voordat je een hele fles koopt.</p>'
arts=[]
arts.append(dict(handle='arabische-parfums-gids',title='Arabische parfums: de complete gids voor beginners',
seo_t='Arabische parfums: complete gids (2026) | Dar Al Scents',
seo_d='Wat zijn Arabische parfums, welke merken zijn goed en hoe kies je de juiste geur? Uitleg over oud, amber en gourmand + tips om eerst te testen.',
img='https://cdn.shopify.com/s/files/1/0957/1064/2525/files/badee-al-oud-amethyst-fles.png?v=1791283452',
tags=['gids','arabische parfums'],
summary='<p>Wat maakt Arabische parfums zo bijzonder, welke merken moet je kennen en hoe kies je een geur die bij jou past? Alles wat je moet weten in één overzicht.</p>',
body=f'''<p>Arabische parfums zijn de laatste jaren enorm populair geworden in Nederland en België. Ze staan bekend om hun rijke, warme geuren, hun sterke geurtrail en hun prijs: een volle fles van 100 ml kost vaak minder dan €50. In deze gids leggen we uit wat Arabische parfums zijn, welke merken je moet kennen en hoe je de juiste geur kiest.</p>
<h2>Wat zijn Arabische parfums?</h2>
<p>Met "Arabische parfums" bedoelen we geuren van parfumhuizen uit het Midden-Oosten, vooral uit de Verenigde Arabische Emiraten. Ze bouwen voort op een eeuwenoude geurtraditie waarin ingrediënten als oud (agarhout), amber, wierook, saffraan en roos centraal staan. Moderne Arabische huizen combineren die klassieke ingrediënten met zoete, fruitige en frisse tonen, waardoor er voor iedere smaak iets is.</p>
<h2>Waarom zijn ze zo populair?</h2>
<ul><li><strong>Sterke geur:</strong> veel Arabische parfums zijn eau de parfum of extrait de parfum en blijven lang op de huid.</li><li><strong>Uitgesproken karakter:</strong> warme, zoete en kruidige geuren die opvallen.</li><li><strong>Betaalbaar:</strong> luxe uitstraling voor een eerlijke prijs.</li><li><strong>Veel keuze:</strong> van frisse zomergeuren tot zware winterparfums.</li></ul>
<h2>De belangrijkste merken</h2>
<p><strong>{C('lattafa-parfum','Lattafa')}</strong> is het bekendste merk, met een enorm aanbod voor dames, heren en unisex, waaronder de Bade'e Al Oud-lijn en de Khamrah-familie. <strong>{C('french-avenue-parfum','French Avenue')}</strong> staat voor rijke, kruidige composities. <strong>{C('rasasi-parfum','Rasasi')}</strong> is bekend van de Hawas-lijn met krachtige, frisse en fruitige geuren. Verder zijn {C('armaf-parfum','Armaf')}, {C('afnan-parfum','Afnan')}, {C('riiffs-parfum','Riiffs')} en {C('maison-alhambra-parfum','Maison Alhambra')} het ontdekken waard.</p>
<h2>De meest voorkomende geurfamilies</h2>
<h3>Oud en houtachtig</h3><p>Oud is een donker, rijk hout met een rokerig, soms leerachtig karakter. Het geeft geuren diepte en luxe. Probeer bijvoorbeeld {P('lattafa-badee-al-oud-amethyst-edp',"Bade'e Al Oud Amethyst")}, waarin oud samengaat met roos, vanille en amber.</p>
<h3>Gourmand (zoet)</h3><p>Gourmandgeuren ruiken naar dessert: vanille, karamel, praliné, koffie of cacao. Een favoriet is {P('lattafa-khamrah-qahwa-edp','Khamrah Qahwa')} met Arabische koffie, praliné en kaneel, of {P('lattafa-angham-edp','Angham')} met cacao en praliné.</p>
<h3>Amber en kruidig</h3><p>Warme specerijen als kaneel, kardemom en saffraan, gecombineerd met amber. {P('french-avenue-cocoa-morado-edp','French Avenue Cocoa Morado')} is een mooi voorbeeld van een rijke, kruidige geur.</p>
<h3>Fris en fruitig</h3><p>Ook voor warme dagen zijn er prachtige Arabische geuren. {P('riiffs-freeze-extrait-parfum-100ml','Riiffs Freeze')} is ijskoud-fris met munt en citrus, en {P('rasasi-hawas-ice-eau-de-parfum','Rasasi Hawas Ice')} combineert appel en citroen met een houtachtige basis.</p>
<h2>Hoe kies je de juiste geur?</h2>
<ol><li><strong>Denk aan het seizoen.</strong> Zoete en houtachtige geuren passen bij herfst en winter, frisse en fruitige geuren bij lente en zomer.</li><li><strong>Kies een geurfamilie.</strong> Houd je van zoet, fris, bloemig of houtachtig? Onze {f'<a href="/pages/geurwijzer">Geurwijzer</a>'} helpt je in een paar vragen op weg.</li><li><strong>Test op je huid.</strong> Een parfum ruikt op iedere huid anders. Daarom raden we aan eerst een sample te proberen.</li></ol>
{SAMPLE}
<h2>Veelgestelde vragen</h2>
<h3>Zijn Arabische parfums origineel?</h3><p>Ja. Bij Dar Al Scents verkopen we uitsluitend originele producten van de merken zelf, geen imitaties.</p>
<h3>Hoe lang blijft een Arabisch parfum ruiken?</h3><p>Dat verschilt per geur en per huid, maar veel eau de parfums en extraits blijven 6 tot 12 uur waarneembaar.</p>
<h3>Hoeveel sprays heb ik nodig?</h3><p>Omdat veel Arabische parfums krachtig zijn, zijn 2 tot 3 sprays op hals en polsen meestal genoeg.</p>
<p>Bekijk ons volledige aanbod {C('dames-parfum','damesparfums')}, {C('heren-parfum-1','herenparfums')} en {C('unisex','unisex parfums')}.</p>'''))

arts.append(dict(handle='beste-lattafa-parfums-heren',title='De beste Lattafa parfums voor mannen',
seo_t='Beste Lattafa parfums voor mannen (2026) | Dar Al Scents',
seo_d='De populairste Lattafa herenparfums op een rij: Khamrah Qahwa, Asad, Fakhar Platinum, Fahad en Bade\'e Al Oud. Met geurnoten en wanneer je ze draagt.',
img='https://cdn.shopify.com/s/files/1/0957/1064/2525/files/fakhar-platinum-fles.png?v=1791283453',
tags=['gids','lattafa','heren'],
summary='<p>Op zoek naar een Lattafa geur voor mannen? Dit zijn onze favorieten, van zoet en warm tot fris en kruidig.</p>',
body=f'''<p>Lattafa is een van de grootste parfumhuizen uit de Emiraten en heeft een enorme collectie herengeuren. Maar welke kies je? We zetten onze favorieten op een rij, met de geurnoten en het moment waarop ze het best tot hun recht komen.</p>
{card('lattafa-khamrah-qahwa-edp','Lattafa Khamrah Qahwa','Een warme gourmandgeur rond Arabische koffie. De opening is kruidig met kaneel, gember en kardemom; in het hart smelt gebrande koffie samen met praliné, en de basis is zacht met vanille, tonkaboon en amber. Perfect voor koude avonden. Officieel unisex, maar heel geliefd bij mannen.')}
{card('lattafa-fakhar-platinum-edp','Lattafa Fakhar Platinum','Fris en kruidig met bergamot, roze peper en kardemom, een aromatisch hart van gember, lavendel en guave en een houtachtige basis van palo santo, wierook en sandelhout. Een veelzijdige geur voor kantoor en avond.')}
{card('lattafa-fahad-edp','Lattafa Fahad','Fahad betekent "luipaard". De geur opent met ananas, mandarijn en zwarte peper, gaat verder met oranjebloesem, lavendel en artemisia en eindigt rokerig-houtachtig met wierook, patchouli en cederhout. Energiek en mannelijk, het hele jaar te dragen.')}
{card('lattafa-asad-bourbon-edp','Lattafa Asad Bourbon','Voor wie van diepe, fluweelzachte geuren houdt: bourbon en bergamot in de opening, zwarte tabak en witte peper in het hart en een basis van leer, amber en donkere vanille. Ideaal voor herfst, winter en formele gelegenheden.')}
{card('lattafa-asad-elixir-edp','Lattafa Asad Elixir','De diepere versie van Asad: zwarte peper en kruidige tabak, daarna wierook, patchouli en donkere koffie, met een rijke basis van amber, vanille en edele houtsoorten. Een geur die opvalt.')}
{card('lattafa-badee-al-oud-honor-glory-edp',"Lattafa Bade'e Al Oud Honor & Glory",'Zoete ananas brûlée in de opening, een kruidig hart van kurkuma, kaneel en zwarte peper en een warme basis van vanille, kasjmier en sandelhout. Een uitgesproken, luxe geur met een overwegend mannelijk karakter.')}
<h2>Welke past bij jou?</h2>
<ul><li><strong>Zoet en warm:</strong> Khamrah Qahwa of Honor & Glory.</li><li><strong>Fris en kruidig, voor elke dag:</strong> Fakhar Platinum of Fahad.</li><li><strong>Donker en stoer:</strong> Asad Bourbon of Asad Elixir.</li></ul>
{SAMPLE}
<h2>Tips om je parfum langer te laten ruiken</h2>
<p>Breng je parfum aan op warme plekken zoals hals, polsen en achter de oren, direct na het douchen op een licht vochtige huid. Wrijf je polsen niet tegen elkaar: dat breekt de topnoten sneller af.</p>
<p>Bekijk alle {C('lattafa-parfum','Lattafa parfums')} of onze volledige collectie {C('heren-parfum-1','herenparfums')}.</p>'''))

arts.append(dict(handle='beste-lattafa-parfums-dames',title='De beste Lattafa parfums voor vrouwen',
seo_t='Beste Lattafa parfums voor vrouwen (2026) | Dar Al Scents',
seo_d='De mooiste Lattafa damesparfums: Yara, Yara Moi, Teriaq, Fakhar Femme, Noble Blush en Angham Second Song. Met geurnoten en draagtips.',
img='https://cdn.shopify.com/s/files/1/0957/1064/2525/files/noble-blush-fles.png?v=1791283452',
tags=['gids','lattafa','dames'],
summary='<p>Zoet, bloemig of juist gourmand? Dit zijn de Lattafa damesgeuren waar onze klanten het meest naar vragen.</p>',
body=f'''<p>Lattafa heeft een prachtige collectie damesparfums, van zacht en romig tot uitgesproken en luxe. Hieronder onze favorieten, met de geurnoten en wanneer je ze het best draagt.</p>
{card('lattafa-yara-edp','Lattafa Yara','Een van de populairste damesgeuren van Lattafa. Zoet, romig en vrouwelijk, met orchidee, heliotroop en mandarijn in de opening, tropisch fruit in het hart en vanille, musk en sandelhout in de basis. Heerlijk voor lente en zomer.')}
{card('lattafa-yara-moi-edp','Lattafa Yara Moi','De elegante, lichtere zus van Yara: sappige peer, roze peper en zwarte bes, een bloemig-romig hart en een warme basis van hout, musk en vanille.')}
{card('lattafa-teriaq-edp','Lattafa Teriaq','Voor wie iets anders zoekt: karamel, roze peper, bittere amandel en rabarber, gevolgd door leer, roos en witte bloemen en een zachte basis van vanille, labdanum en musk. Modern en luxueus, ideaal voor herfst en winter.')}
{card('lattafa-fakhar-femme-edp','Lattafa Fakhar Femme','Een ode aan glamour: granaatappel en lelie in de opening, een rijk boeket van tuberoos, gardenia, jasmijn en roos in het hart en een zijdezachte basis van vanille, witte musk en sandelhout.')}
{card('lattafa-badee-al-oud-noble-blush-edp',"Lattafa Bade'e Al Oud Noble Blush",'Romantisch en fluweelzacht: peer en bergamot, gevolgd door Turkse roos, marshmallow en jasmijn, met een romige basis van vanille, witte musk en amber.')}
{card('lattafa-angham-second-song-edp','Lattafa Angham Second Song','Een zoete bloemengeur met moderne elegantie: bergamot en peer, oranjebloesem, pioen en praliné in het hart en een zachte basis van vanille, tonkaboon en muskus.')}
<h2>Welke past bij jou?</h2>
<ul><li><strong>Zoet en romig:</strong> Yara of Noble Blush.</li><li><strong>Fruitig en licht:</strong> Yara Moi of Angham Second Song.</li><li><strong>Uitgesproken en luxe:</strong> Teriaq of Fakhar Femme.</li></ul>
{SAMPLE}
<p>Bekijk alle {C('lattafa-parfum','Lattafa parfums')} of onze volledige collectie {C('dames-parfum','damesparfums')}.</p>'''))

arts.append(dict(handle='verschil-edp-edt-extrait-de-parfum',title='Wat is het verschil tussen EDT, EDP en extrait de parfum?',
seo_t='Verschil EDT, EDP en extrait de parfum | Dar Al Scents',
seo_d='Eau de toilette, eau de parfum of extrait de parfum: wat is het verschil in concentratie, geurduur en prijs? Simpel uitgelegd met voorbeelden.',
img='https://cdn.shopify.com/s/files/1/0957/1064/2525/files/riiffs-momento-liquid-gold-1600.png?v=1791284925',
tags=['gids','uitleg'],
summary='<p>EDT, EDP, extrait: wat betekenen die afkortingen en welke blijft het langst ruiken? Simpel uitgelegd.</p>',
body=f'''<p>Op parfumflessen zie je termen als eau de toilette (EDT), eau de parfum (EDP) en extrait de parfum. Het verschil zit vooral in de <strong>concentratie geurolie</strong>: hoe meer geurolie, hoe intenser en langer de geur meestal blijft hangen.</p>
<h2>De concentraties op een rij</h2>
<table><thead><tr><th>Type</th><th>Geurolie (ongeveer)</th><th>Geurduur (indicatie)</th></tr></thead><tbody>
<tr><td>Eau de toilette (EDT)</td><td>5–15%</td><td>3–5 uur</td></tr>
<tr><td>Eau de parfum (EDP)</td><td>15–20%</td><td>5–8 uur</td></tr>
<tr><td>Extrait de parfum</td><td>20–40%</td><td>8–12 uur of langer</td></tr></tbody></table>
<p>Let op: dit zijn richtwaarden. Hoe lang een geur blijft ruiken hangt ook af van de ingrediënten (houtachtige en zoete noten blijven langer dan citrus), je huidtype en het weer.</p>
<h2>Eau de toilette</h2><p>Lichter en frisser, ideaal voor overdag en warme dagen. Een voorbeeld uit ons aanbod is {P('armaf-club-nuit-intense-105ml','Armaf Club de Nuit Intense Man (EDT)')}, die ondanks de EDT-concentratie bekendstaat om zijn sterke aanwezigheid.</p>
<h2>Eau de parfum</h2><p>De meest gekozen concentratie: lang genoeg voor een hele dag, maar niet overweldigend. De meeste geuren van {C('lattafa-parfum','Lattafa')}, zoals {P('lattafa-khamrah-qahwa-edp','Khamrah Qahwa')}, zijn eau de parfum.</p>
<h2>Extrait de parfum</h2><p>De meest geconcentreerde vorm. Eén of twee sprays zijn vaak genoeg. Probeer bijvoorbeeld {P('riiffs-momento-liquid-gold-extrait-de-parfum','Riiffs Momento Liquid Gold')} met saffraan, roos, oud en karamel, of het frisse {P('riiffs-freeze-extrait-parfum-100ml','Riiffs Freeze')}.</p>
<h2>Welke moet je kiezen?</h2><ul><li><strong>Voor kantoor en warme dagen:</strong> EDT of een frisse EDP.</li><li><strong>Voor elke dag, de hele dag:</strong> EDP.</li><li><strong>Voor avonden en maximale geurduur:</strong> extrait de parfum.</li></ul>
{SAMPLE}
<h2>Veelgestelde vragen</h2><h3>Is een extrait altijd beter?</h3><p>Niet per se. Een extrait is intenser, maar of je een geur mooi vindt hangt af van de compositie, niet alleen de concentratie.</p><h3>Waarom ruik ik mijn eigen parfum niet meer?</h3><p>Je neus went snel aan een geur. Anderen ruiken hem vaak nog wel, ook als jij hem niet meer opmerkt.</p>'''))

arts.append(dict(handle='winterparfums-warme-geuren',title='Winterparfums: 7 warme geuren voor koude dagen',
seo_t='Winterparfums 2026: 7 warme geuren | Dar Al Scents',
seo_d='De beste winterparfums voor dames en heren: warme, zoete en kruidige geuren met vanille, oud, amber en koffie. Met tips voor de koude maanden.',
img='https://cdn.shopify.com/s/files/1/0957/1064/2525/files/khamrah-qahwa-fles.png?v=1791283453',
tags=['gids','winter'],
summary='<p>Als het kouder wordt, zijn warme en zoete geuren op hun best. Dit zijn onze zeven favorieten voor de winter.</p>',
body=f'''<p>In de winter komen zware, warme geuren het best tot hun recht. Door de kou verdampt een parfum langzamer, waardoor zoete, houtachtige en kruidige noten mooi blijven hangen. Dit zijn onze zeven favorieten voor de koude maanden.</p>
{card('lattafa-khamrah-qahwa-edp','1. Lattafa Khamrah Qahwa (unisex)','Arabische koffie, praliné, kaneel en vanille: als een warme koffie bij de open haard.')}
{card('french-avenue-cocoa-morado-edp','2. French Avenue Cocoa Morado (unisex)','Kaneel, saffraan, dadels, karamel en vanille. Rijk, kruidig en omhullend.')}
{card('lattafa-teriaq-edp','3. Lattafa Teriaq (dames)','Karamel en bittere amandel met leer en roos: zoet met een eigenzinnig randje.')}
{card('lattafa-asad-bourbon-edp','4. Lattafa Asad Bourbon (heren)','Bourbon, tabak, leer en donkere vanille. Diep en fluweelzacht.')}
{card('rasasi-hawas-reina-edp','5. Rasasi Hawas Reina (dames)','Abrikoos, frangipani, kokos en karamelsuiker: romig, warm en koninklijk.')}
{card('lattafa-badee-al-oud-amethyst-edp',"6. Lattafa Bade'e Al Oud Amethyst (unisex)",'Roos en jasmijn op een basis van oud, vanille en amber. Elegant en oriëntaals.')}
{card('riiffs-momento-liquid-gold-extrait-de-parfum','7. Riiffs Momento Liquid Gold (unisex)','Saffraan, roos, oud en karamel als extrait de parfum: tot 12 uur geur.')}
<h2>Tips voor parfum in de winter</h2><ul><li>Spray ook op je sjaal of kraag: stof houdt geur lang vast.</li><li>Gebruik een geurloze bodylotion; een gehydrateerde huid houdt parfum langer vast.</li><li>Met zware wintergeuren is minder meer: 2 sprays zijn vaak genoeg.</li></ul>
{SAMPLE}
<p>Op zoek naar een cadeau? Bekijk onze {C('cadeaus-onder-30','cadeaus onder €30')} en {C('giftset','giftsets')}, of alle {C('winter-collectie','wintergeuren voor heren')} en {C('winter-collectie-dames','wintergeuren voor dames')}.</p>'''))
json.dump(arts,open('articles.json','w'),ensure_ascii=False,indent=1)
for a in arts: print(a['handle'],len(a['body']),len(a['seo_t']),len(a['seo_d']))
