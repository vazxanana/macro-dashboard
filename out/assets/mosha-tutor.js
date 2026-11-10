// Mosha desk, the tutorial (owner, 10 Nov 2026: "a proper tutorial because the better he knows how to work with you he would do
// better", "the more the quality of the tutorial the better for him", in English or French with the trading terms left in English).
// Nine short chapters for the desk's teacher: what the desk is, what a good lesson holds, how to send it, what the desk can and
// cannot read on a screenshot, how to check and correct its answer, the book, teaching from a ChronosTrade replay, the habits
// that make it learn faster, and a first session. Each chapter has a picture of what to press (drawn here, no image files), an
// example of a weak and a good way where that helps, and one question with an explained answer.
// It is a tutorial for TEACHING: it never says a trade wins. tests/mosha-i18n.test.mjs checks that the two languages have the
// same chapters, blocks and answers, and that the French keeps the method's words in English.
(function (root) {
  'use strict';
  var I = function () { return root.MS_MOSHA_I18N || { lang: function () { return 'en'; }, tr: function (s) { return s; }, LANGS: ['en'], NAMES: { en: 'English' } }; };
  var T = function (s, v) { var x = I().tr(s); return v ? x.replace(/\{(\w+)\}/g, function (m, k) { return v[k] != null ? v[k] : m; }) : x; };

  // ─── the chapters ───  blocks: p, h (small heading), ul, ol, tip, warn, fig, cmp { bad, good }, dd { yes, no }
  var EN = [
    { k: 'start', t: 'What you are doing here', lead: 'You are teaching the desk to read a chart the way you do. It knows nothing about your method until you show it.',
      body: [{ fig: 'loop' },
        { p: 'The desk is an assistant. It learns from two things only: the lessons you send, and the lines of its book that you confirm. Nothing else.' },
        { p: 'Teaching goes round in a circle. You send a trade. The desk writes what it understood. You say right, or not right and why. What is right goes into the book, and the desk reads the book before every new lesson.' },
        { tip: 'It never places, copies or changes a trade. Everything on this desk is teaching.' },
        { p: 'The clearer the lesson, the fewer rounds it takes. The next chapters show what a clear lesson looks like, how to correct the desk, and how to teach many trades quickly from a replay.' }],
      quiz: { q: 'What does the desk learn from?', o: [
        { t: 'Your lessons and the book lines you confirm', ok: true, why: 'Yes. Those are its only two sources.' },
        { t: 'Watching the market by itself', why: 'No. The desk only knows what you show it and confirm.' },
        { t: 'Your trading account', why: 'No. The desk never sees or touches an account.' }] } },
    { k: 'lesson', t: 'A good lesson', lead: 'One trade, or one idea, per lesson. Show it top-down, name each picture, and say why.',
      body: [{ fig: 'order' },
        { ol: ['Pictures in order. The higher timeframe first (H4 or H1), then the M15 or M5 entry, then how it ended.',
          'A caption on every picture. Name what it shows: "H4 BO sell", "M30 sweep high", "M5 vr", "M5 cf for sell". Tap the ready-made captions or type your own.',
          'Mark the chart before the screenshot. Draw the level, the VR box, the entry, the stop and the target. The desk reads marks and prices far better than bare candles.',
          'Say why, in two or three sentences. What you waited for, what made you enter, where the stop goes and why.',
          'Give the levels when you can: sell or buy, entry, stop, target, time. With them the desk puts the trade on its own chart and replays it.'] },
        { cmp: { bad: { pics: 'one picture, no caption', words: '"sell"', why: 'The desk sees a chart and a word. It has to guess the level, the VR and the reason.' },
          good: { pics: 'H4 BO sell · M30 sweep high · M5 vr + M5 cf', words: 'H4 broke down. I waited for the pullback to sweep the M30 high. The M5 VR formed and the CF closed below it. Sell after the CF, stop above the VR, target the H4 low.', why: 'The desk knows the order, the levels and the reason, in your words.' } } },
        { tip: 'A trade you skipped, or one that lost, is a lesson too. Say what was missing or what went wrong.' }],
      quiz: { q: 'Which lesson teaches the desk most?', o: [
        { t: 'Five pictures, no captions, no words', why: 'The desk would have to guess what each picture is for.' },
        { t: 'Three captioned pictures, top-down, with two sentences on why', ok: true, why: 'Yes. Order, names and the reason: that is everything it needs.' },
        { t: 'One sentence: "sell here"', why: 'It says what, not why. The desk cannot learn the reason.' }] },
      go: { k: 'send', label: 'Show me the form' } },
    { k: 'form', t: 'Sending it, step by step', lead: 'The form has three parts: pictures, words, Send. Everything else is optional.',
      body: [{ fig: 'form' },
        { ol: ['Choose screenshots, or drop them anywhere on the page, or paste one. Up to 8 at a time.',
          'Tap a caption under each picture, or type one.',
          'Write what the desk should learn. What you type is kept on your device until you send it.',
          'Press Send to the desk. No name is needed: the desk names the lesson from your words.'] },
        { p: 'Under "Name it, give the levels…" you can name the lesson, give the levels of the trade, or add the pictures to a lesson you sent earlier.' },
        { tip: 'No picture? Write only. "Never sell before the M5 CF closes" is a full lesson.' }],
      quiz: { q: 'You forgot one picture of a lesson you already sent. What do you do?', o: [
        { t: 'Send a new lesson with only that picture', why: 'It would be read alone, without the rest of the trade.' },
        { t: 'Open the lesson and press "Add pictures"', ok: true, why: 'Yes. The picture joins the lesson and the desk reads it again as a whole.' },
        { t: 'Nothing can be added', why: 'It can: "Add pictures", under the lesson.' }] } },
    { k: 'see', t: 'What the desk can see, and what it cannot', lead: 'The desk reads your screenshot like a careful student who was not in the room.',
      body: [{ fig: 'chart' },
        { h: 'It can read' },
        { ul: ['The prices on the scale and the times along the bottom. Keep both in the picture.', 'The symbol and the timeframe at the top. Keep them too.', 'Your lines, boxes and labels.'] },
        { h: 'It cannot know' },
        { ul: ['What you were thinking, or what you saw on another chart, unless you write it.', 'Anything cut out of the picture or too small to read. Zoom so the entry is clear.', 'Which clock your chart uses. It assumes New York time: tell it once if yours is different.'] },
        { tip: 'When the desk is unsure it says so and asks. Answer under the lesson. That is part of teaching.' }],
      quiz: { q: 'You crop the screenshot and the price scale is gone. What happens?', o: [
        { t: 'Nothing changes', why: 'Without the scale the desk cannot read the levels.' },
        { t: 'The desk cannot read your entry, stop and target', ok: true, why: 'Yes. Keep the price scale and the time axis in every picture.' },
        { t: 'The desk reads them from the candles', why: 'It cannot: candles alone carry no prices.' }] } },
    { k: 'answer', t: 'Reading the desk\'s answer', lead: 'Under each lesson the desk writes what it understood. Check it the way you would check a student\'s notes.',
      body: [{ fig: 'answer' },
        { h: 'Three things to check' },
        { ol: ['The levels. Did it read the right entry, stop and target, and the level that was swept?', 'The order. Are the steps in your order: sweep, then VR, then CF, then entry?', 'The reason. Did it get why, and not only what the picture shows?'] },
        { p: 'All three right: press "That is right". One of them wrong: press "Not right…" and write the correction under the answer. The desk answers again.' },
        { cmp: { kind: 'fix', bad: { words: '"No."', why: 'The desk knows it is wrong, not what is right.' },
          good: { words: '"No. For a sell the VR starts at the high and runs down to the last swing low before it."', why: 'It says what is wrong and what is right. The desk answers again with the correction.' } } },
        { p: '"See the desk\'s reading on the chart" draws what it understood on the desk\'s own candles, with a replay. Check that its marks sit where you would put them.' }],
      quiz: { q: 'The desk got the levels right but put the VR in the wrong place. What do you press?', o: [
        { t: '"That is right", it is close enough', why: 'Then the wrong VR stays in its memory. Close is not right.' },
        { t: '"Not right…", and say where the VR really starts and ends', ok: true, why: 'Yes. One clear correction, and it answers again.' },
        { t: 'Remove the lesson', why: 'No need. Correct it: the correction is what teaches.' }] },
      go: { k: 'judge', label: 'Show me the lessons' } },
    { k: 'book', t: 'The book: what the desk knows', lead: 'The book is the desk\'s whole memory of your method, one line at a time. It reads the book before every lesson.',
      body: [{ fig: 'book' },
        { ul: ['Four kinds of lines: Terms (what a word means), Steps (the order), Rules, and What to avoid.',
          'A line marked "the desk\'s reading, not confirmed" is its own guess. It is not yours until you press Right.',
          'Correct rewrites the line in your words. Erase removes it.',
          'Teach a line yourself when you have a rule to give: short, one idea, the way you would say it.'] },
        { warn: 'Do not leave a wrong line in the book. The desk will keep using it.' },
        { tip: 'Use the same word for the same thing every time. If you use a new word, teach it as a Term first.' }],
      quiz: { q: 'A line in the book is almost right, but one word is wrong. What do you press?', o: [
        { t: 'Right', why: 'Then the wrong word becomes your word.' },
        { t: 'Correct, and fix the word', ok: true, why: 'Yes. Your wording replaces the desk\'s.' },
        { t: 'Leave it', why: 'An unchecked line stays the desk\'s guess, and it keeps reading it.' }] },
      go: { k: 'book', label: 'Show me the book' } },
    { k: 'replay', t: 'Backtest together in ChronosTrade', lead: 'The fastest way to teach many trades: replay past days and trade them the way you would.',
      body: [{ fig: 'chip' },
        { ol: ['Open ChronosTrade, pick a market and a day, and press Play. Buy or Sell opens a trade, always with a stop.',
          'When a trade closes, press "Teach this trade" on the chart, or the T key.',
          'Write one or two sentences on why you took it, and send. The chart, entry, stop, target and result go with it.',
          'Back on the desk, the lesson is marked "from a ChronosTrade replay". You judge the answer like any other.'] },
        { p: 'The teach button in the toolbar also sends the chart as it stands, with no trade. Use it for "here I wait" or "here I would not trade". Your drawings on the chart go with the picture.' },
        { tip: 'Replay trades are practice on past candles. They teach the desk your method. They are not a record of results.' }],
      quiz: { q: 'In the replay you see a setup you would NOT take. Can you teach that?', o: [
        { t: 'No, only closed trades can be sent', why: 'The toolbar button sends the chart as it stands, without a trade.' },
        { t: 'Yes: send the moment and say why you stay out', ok: true, why: 'Yes. What you skip teaches as much as what you take.' },
        { t: 'Only by taking the trade and losing', why: 'No need to take it. Send the moment with your reason.' }] },
      go: { href: '/backtest', label: 'Open ChronosTrade' } },
    { k: 'habits', t: 'Habits that make the desk learn faster', lead: 'A few habits matter more than the number of lessons.',
      body: [{ dd: { yes: ['Two or three good lessons a day.', 'Correct the desk the same day.', 'Show the trades you skipped and the ones that failed.', 'Keep your words the same: VR, CF, sweep, BO.', 'Open "Your turn" first when you come to the desk.'],
          no: ['Twenty lessons in one go.', 'Leaving an answer that is "almost" right.', 'Sending only winners.', 'Two names for the same thing.', 'Cropping out the prices or the times.'] } },
        { h: 'What to expect' },
        { p: 'The desk does not answer the second you send. It reads when it is run, so an answer can take a while. Your lesson is kept safely in the meantime, and "Your turn" shows when the answer is there.' },
        { p: 'The desk learns how you trade. Whether a rule makes money is tested separately, on years of data, before anyone relies on it.' }],
      quiz: { q: 'The desk answered yesterday and it was not quite right. You are busy. Best move?', o: [
        { t: 'Leave it and send new lessons', why: 'New lessons are read with the old mistake still in place.' },
        { t: 'Take one minute to correct it first', ok: true, why: 'Yes. Corrections first, new lessons after.' },
        { t: 'Erase the book', why: 'No. Correct that one answer; the book keeps what is right.' }] } },
    { k: 'go', t: 'You are ready', lead: 'Start with one trade you know by heart.',
      body: [{ h: 'Your first session' },
        { ol: ['Pick one trade you know well and take three screenshots: higher timeframe, entry, result.',
          'Send it with captions and two sentences on why.',
          'While the desk reads, check the first lines of the book.',
          'When "Your turn" shows an answer, say right or not right.',
          'Then try one day in ChronosTrade and teach a trade from the replay.'] },
        { tip: 'You can open this tutorial again at any time: press "How to teach", then "Read the tutorial again".' }],
      go: { k: 'send', label: 'Send my first trade' } }];

  var FR = [
    { k: 'start', t: 'Ce que vous faites ici', lead: 'Vous apprenez au desk à lire un graphique comme vous le lisez. Il ne sait rien de votre méthode tant que vous ne la lui montrez pas.',
      body: [{ fig: 'loop' },
        { p: 'Le desk est un assistant. Il apprend de deux choses seulement : les leçons que vous envoyez, et les lignes de son livre que vous confirmez. Rien d\'autre.' },
        { p: 'L\'enseignement tourne en boucle. Vous envoyez un trade. Le desk écrit ce qu\'il a compris. Vous dites si c\'est juste, ou pas juste et pourquoi. Ce qui est juste entre dans le livre, et le desk relit le livre avant chaque nouvelle leçon.' },
        { tip: 'Il ne place, ne copie et ne modifie jamais un trade. Tout ce qui se passe sur ce desk est de l\'enseignement.' },
        { p: 'Plus la leçon est claire, moins il faut d\'allers-retours. Les chapitres suivants montrent à quoi ressemble une leçon claire, comment corriger le desk, et comment enseigner beaucoup de trades rapidement depuis un replay.' }],
      quiz: { q: 'De quoi le desk apprend-il ?', o: [
        { t: 'De vos leçons et des lignes du livre que vous confirmez', ok: true, why: 'Oui. Ce sont ses deux seules sources.' },
        { t: 'En observant le marché tout seul', why: 'Non. Le desk ne sait que ce que vous lui montrez et confirmez.' },
        { t: 'De votre compte de trading', why: 'Non. Le desk ne voit et ne touche jamais un compte.' }] } },
    { k: 'lesson', t: 'Une bonne leçon', lead: 'Un trade, ou une idée, par leçon. Montrez-le en top-down, nommez chaque image, et dites pourquoi.',
      body: [{ fig: 'order' },
        { ol: ['Les images dans l\'ordre. Le timeframe supérieur d\'abord (H4 ou H1), puis l\'entry en M15 ou M5, puis la façon dont le trade s\'est terminé.',
          'Une légende sur chaque image. Nommez ce qu\'elle montre : « H4 BO sell », « M30 sweep high », « M5 vr », « M5 cf for sell ». Touchez les légendes proposées ou tapez la vôtre.',
          'Marquez le graphique avant la capture. Tracez le level, la boîte du VR, l\'entry, le stop et le target. Le desk lit bien mieux les tracés et les prix que des bougies nues.',
          'Dites pourquoi, en deux ou trois phrases. Ce que vous attendiez, ce qui vous a fait entrer, où va le stop et pourquoi.',
          'Donnez les niveaux de prix quand vous le pouvez : sell ou buy, entry, stop, target, heure. Avec eux, le desk place le trade sur son propre graphique et le rejoue.'] },
        { cmp: { bad: { pics: 'une image, sans légende', words: '« sell »', why: 'Le desk voit un graphique et un mot. Il doit deviner le level, le VR et la raison.' },
          good: { pics: 'H4 BO sell · M30 sweep high · M5 vr + M5 cf', words: 'H4 a cassé à la baisse. J\'ai attendu que le pullback fasse le sweep du high M30. Le VR M5 s\'est formé et le CF a clôturé en dessous. Sell après le CF, stop au-dessus du VR, target le low H4.', why: 'Le desk connaît l\'ordre, les niveaux de prix et la raison, avec vos mots.' } } },
        { tip: 'Un trade que vous n\'avez pas pris, ou un trade perdant, est aussi une leçon. Dites ce qui manquait ou ce qui n\'a pas marché.' }],
      quiz: { q: 'Quelle leçon apprend le plus au desk ?', o: [
        { t: 'Cinq images, sans légende, sans mots', why: 'Le desk devrait deviner à quoi sert chaque image.' },
        { t: 'Trois images légendées, en top-down, avec deux phrases sur le pourquoi', ok: true, why: 'Oui. L\'ordre, les noms et la raison : c\'est tout ce qu\'il lui faut.' },
        { t: 'Une phrase : « sell ici »', why: 'Elle dit quoi, pas pourquoi. Le desk ne peut pas apprendre la raison.' }] },
      go: { k: 'send', label: 'Montrez-moi le formulaire' } },
    { k: 'form', t: 'L\'envoi, pas à pas', lead: 'Le formulaire a trois parties : les images, les mots, Envoyer. Tout le reste est facultatif.',
      body: [{ fig: 'form' },
        { ol: ['Choisissez des captures, ou déposez-les n\'importe où sur la page, ou collez-en une. Jusqu\'à 8 à la fois.',
          'Touchez une légende sous chaque image, ou tapez-en une.',
          'Écrivez ce que le desk doit retenir. Ce que vous tapez est gardé sur votre appareil jusqu\'à l\'envoi.',
          'Appuyez sur Envoyer au desk. Pas besoin de nom : le desk nomme la leçon d\'après vos mots.'] },
        { p: 'Sous « Nommer, donner les niveaux de prix… », vous pouvez nommer la leçon, donner les niveaux de prix du trade, ou ajouter les images à une leçon déjà envoyée.' },
        { tip: 'Pas d\'image ? Écrivez seulement. « Jamais de sell avant la clôture du CF M5 » est une leçon complète.' }],
      quiz: { q: 'Vous avez oublié une image dans une leçon déjà envoyée. Que faites-vous ?', o: [
        { t: 'J\'envoie une nouvelle leçon avec cette seule image', why: 'Elle serait lue seule, sans le reste du trade.' },
        { t: 'J\'ouvre la leçon et j\'appuie sur « Ajouter des images »', ok: true, why: 'Oui. L\'image rejoint la leçon et le desk la relit en entier.' },
        { t: 'On ne peut rien ajouter', why: 'Si : « Ajouter des images », sous la leçon.' }] } },
    { k: 'see', t: 'Ce que le desk voit, et ce qu\'il ne voit pas', lead: 'Le desk lit votre capture comme un élève attentif qui n\'était pas dans la pièce.',
      body: [{ fig: 'chart' },
        { h: 'Il peut lire' },
        { ul: ['Les prix sur l\'échelle et les heures en bas. Gardez les deux dans l\'image.', 'Le symbole et le timeframe en haut. Gardez-les aussi.', 'Vos lignes, vos boîtes et vos étiquettes.'] },
        { h: 'Il ne peut pas savoir' },
        { ul: ['Ce que vous pensiez, ou ce que vous avez vu sur un autre graphique, sauf si vous l\'écrivez.', 'Ce qui est coupé de l\'image ou trop petit pour être lu. Zoomez pour que l\'entry soit nette.', 'Quelle horloge utilise votre graphique. Il suppose l\'heure de New York : dites-le-lui une fois si la vôtre est différente.'] },
        { tip: 'Quand le desk n\'est pas sûr, il le dit et pose la question. Répondez-lui sous la leçon. Cela fait partie de l\'enseignement.' }],
      quiz: { q: 'Vous recadrez la capture et l\'échelle des prix disparaît. Que se passe-t-il ?', o: [
        { t: 'Rien ne change', why: 'Sans l\'échelle, le desk ne peut pas lire les niveaux de prix.' },
        { t: 'Le desk ne peut plus lire votre entry, votre stop et votre target', ok: true, why: 'Oui. Gardez l\'échelle des prix et l\'axe du temps dans chaque image.' },
        { t: 'Le desk les lit sur les bougies', why: 'Il ne peut pas : les bougies seules ne portent aucun prix.' }] } },
    { k: 'answer', t: 'Lire la réponse du desk', lead: 'Sous chaque leçon, le desk écrit ce qu\'il a compris. Vérifiez-le comme vous vérifieriez les notes d\'un élève.',
      body: [{ fig: 'answer' },
        { h: 'Trois choses à vérifier' },
        { ol: ['Les niveaux de prix. A-t-il lu la bonne entry, le bon stop et le bon target, et le level qui a subi le sweep ?', 'L\'ordre. Les étapes sont-elles dans votre ordre : sweep, puis VR, puis CF, puis entry ?', 'La raison. A-t-il compris le pourquoi, et pas seulement ce que montre l\'image ?'] },
        { p: 'Les trois sont justes : appuyez sur « C\'est juste ». L\'une est fausse : appuyez sur « Pas juste… » et écrivez la correction sous la réponse. Le desk répond à nouveau.' },
        { cmp: { kind: 'fix', bad: { words: '« Non. »', why: 'Le desk sait que c\'est faux, pas ce qui est juste.' },
          good: { words: '« Non. Pour un sell, le VR commence au high et descend jusqu\'au dernier swing low avant lui. »', why: 'Elle dit ce qui est faux et ce qui est juste. Le desk répond à nouveau avec la correction.' } } },
        { p: '« Voir la lecture du desk sur le graphique » dessine ce qu\'il a compris sur les bougies du desk, avec un replay. Vérifiez que ses tracés sont là où vous les mettriez.' }],
      quiz: { q: 'Le desk a les bons niveaux de prix mais a placé le VR au mauvais endroit. Sur quoi appuyez-vous ?', o: [
        { t: '« C\'est juste », c\'est assez proche', why: 'Alors le mauvais VR reste dans sa mémoire. Proche n\'est pas juste.' },
        { t: '« Pas juste… », et je dis où le VR commence et finit vraiment', ok: true, why: 'Oui. Une correction claire, et il répond à nouveau.' },
        { t: 'Je supprime la leçon', why: 'Inutile. Corrigez-le : c\'est la correction qui enseigne.' }] },
      go: { k: 'judge', label: 'Montrez-moi les leçons' } },
    { k: 'book', t: 'Le livre : ce que le desk sait', lead: 'Le livre est toute la mémoire que le desk a de votre méthode, une ligne à la fois. Il le relit avant chaque leçon.',
      body: [{ fig: 'book' },
        { ul: ['Quatre types de lignes : Termes (ce qu\'un mot veut dire), Étapes (l\'ordre), Règles, et À éviter.',
          'Une ligne marquée « Lecture du desk, non confirmée » est sa propre supposition. Elle n\'est pas la vôtre tant que vous n\'avez pas appuyé sur Juste.',
          'Corriger réécrit la ligne avec vos mots. Effacer la supprime.',
          'Enseignez vous-même une ligne quand vous avez une règle à donner : courte, une seule idée, comme vous la diriez.'] },
        { warn: 'Ne laissez pas une ligne fausse dans le livre. Le desk continuera à s\'en servir.' },
        { tip: 'Utilisez toujours le même mot pour la même chose. Si vous employez un mot nouveau, enseignez-le d\'abord comme Terme.' }],
      quiz: { q: 'Une ligne du livre est presque juste, mais un mot est faux. Sur quoi appuyez-vous ?', o: [
        { t: 'Juste', why: 'Alors le mot faux devient votre mot.' },
        { t: 'Corriger, et je change le mot', ok: true, why: 'Oui. Votre formulation remplace celle du desk.' },
        { t: 'Je la laisse', why: 'Une ligne non vérifiée reste une supposition du desk, et il continue à la lire.' }] },
      go: { k: 'book', label: 'Montrez-moi le livre' } },
    { k: 'replay', t: 'Backtest ensemble dans ChronosTrade', lead: 'Le moyen le plus rapide d\'enseigner beaucoup de trades : le replay de journées passées, tradées comme vous le feriez.',
      body: [{ fig: 'chip' },
        { ol: ['Ouvrez ChronosTrade, choisissez un marché et un jour, et appuyez sur Play. Buy ou Sell ouvre un trade, toujours avec un stop.',
          'Quand un trade se clôture, appuyez sur « Enseigner ce trade » sur le graphique, ou sur la touche T.',
          'Écrivez une ou deux phrases sur la raison du trade, et envoyez. Le graphique, l\'entry, le stop, le target et le résultat partent avec.',
          'De retour sur le desk, la leçon est marquée « issu d\'un replay ChronosTrade ». Vous jugez la réponse comme pour toute autre leçon.'] },
        { p: 'Le bouton d\'enseignement de la barre d\'outils envoie aussi le graphique tel qu\'il est, sans trade. Servez-vous-en pour « ici j\'attends » ou « ici je ne traderais pas ». Vos tracés sur le graphique partent avec l\'image.' },
        { tip: 'Les trades du replay sont de l\'entraînement sur des bougies passées. Ils enseignent votre méthode au desk. Ce ne sont pas des résultats.' }],
      quiz: { q: 'Dans le replay, vous voyez un setup que vous ne prendriez PAS. Pouvez-vous l\'enseigner ?', o: [
        { t: 'Non, seuls les trades clôturés peuvent être envoyés', why: 'Le bouton de la barre d\'outils envoie le graphique tel qu\'il est, sans trade.' },
        { t: 'Oui : j\'envoie le moment et je dis pourquoi je reste dehors', ok: true, why: 'Oui. Ce que vous évitez enseigne autant que ce que vous prenez.' },
        { t: 'Seulement en prenant le trade et en perdant', why: 'Inutile de le prendre. Envoyez le moment avec votre raison.' }] },
      go: { href: '/backtest', label: 'Ouvrir ChronosTrade' } },
    { k: 'habits', t: 'Les habitudes qui font apprendre le desk plus vite', lead: 'Quelques habitudes comptent plus que le nombre de leçons.',
      body: [{ dd: { yes: ['Deux ou trois bonnes leçons par jour.', 'Corriger le desk le jour même.', 'Montrer les trades évités et ceux qui ont échoué.', 'Garder les mêmes mots : VR, CF, sweep, BO.', 'Ouvrir « À vous » en premier en arrivant sur le desk.'],
          no: ['Vingt leçons d\'un coup.', 'Laisser une réponse « presque » juste.', 'N\'envoyer que des gagnants.', 'Deux noms pour la même chose.', 'Couper les prix ou les heures de l\'image.'] } },
        { h: 'À quoi s\'attendre' },
        { p: 'Le desk ne répond pas à la seconde où vous envoyez. Il lit quand on le lance, donc une réponse peut prendre un moment. Votre leçon est gardée en sécurité entre-temps, et « À vous » indique quand la réponse est là.' },
        { p: 'Le desk apprend comment vous tradez. Savoir si une règle gagne de l\'argent se teste à part, sur des années de données, avant que quiconque ne s\'y fie.' }],
      quiz: { q: 'Le desk a répondu hier et ce n\'était pas tout à fait juste. Vous êtes pressé. Le mieux ?', o: [
        { t: 'Laisser et envoyer de nouvelles leçons', why: 'Les nouvelles leçons sont lues avec l\'ancienne erreur toujours en place.' },
        { t: 'Prendre une minute pour le corriger d\'abord', ok: true, why: 'Oui. Les corrections d\'abord, les nouvelles leçons ensuite.' },
        { t: 'Effacer le livre', why: 'Non. Corrigez cette réponse ; le livre garde ce qui est juste.' }] } },
    { k: 'go', t: 'Vous êtes prêt', lead: 'Commencez par un trade que vous connaissez par cœur.',
      body: [{ h: 'Votre première session' },
        { ol: ['Choisissez un trade que vous connaissez bien et faites trois captures : timeframe supérieur, entry, résultat.',
          'Envoyez-le avec des légendes et deux phrases sur le pourquoi.',
          'Pendant que le desk lit, vérifiez les premières lignes du livre.',
          'Quand « À vous » affiche une réponse, dites si c\'est juste ou pas juste.',
          'Puis essayez une journée dans ChronosTrade et enseignez un trade depuis le replay.'] },
        { tip: 'Vous pouvez rouvrir ce tutoriel à tout moment : appuyez sur « Comment enseigner », puis sur « Relire le tutoriel ».' }],
      go: { k: 'send', label: 'Envoyer mon premier trade' } }];
  // French typography, as in the dictionary: a non-breaking space before : ; ? ! and inside « »
  (function nb(x) { if (typeof x === 'string') return x.replace(/ ([:;?!»])/g, ' $1').replace(/« /g, '« '); if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) x[i] = nb(x[i]); return x; } if (x && typeof x === 'object') Object.keys(x).forEach(function (k) { if (k !== 'k' && k !== 'fig' && k !== 'href' && k !== 'kind') x[k] = nb(x[k]); }); return x; })(FR);

  // the words inside the pictures
  var FIG = {
    en: { loop: ['You send a trade', 'The desk writes what it understood', 'You say right, or not right', 'The book keeps what is right'], again: 'and round again',
      order: ['Higher timeframe', 'The level', 'The entry', 'How it ended'], result: 'Result',
      chart: ['The price scale', 'The time axis', 'The symbol and the timeframe', 'Your marks: level, VR, entry, stop, target'], chartT: 'What the desk reads on a screenshot',
      formN: ['Pictures', 'Captions', 'Your words', 'Send'], note: 'M30 high swept, then the M5 VR. Sell after the CF, stop above the VR.',
      answer: 'A sell after the M30 high is swept. The M5 VR runs from the high 3919.5 down to 3906.5. Entry after the M5 CF, stop above the VR.',
      key: 'or the key', bad: 'Weak', good: 'Good', yes: 'Do', no: 'Avoid', check: 'Check yourself', tip: 'Tip', warn: 'Careful', right: 'Right answer', wrong: 'Not this one' },
    fr: { loop: ['Vous envoyez un trade', 'Le desk écrit ce qu\'il a compris', 'Vous dites juste, ou pas juste', 'Le livre garde ce qui est juste'], again: 'et ainsi de suite',
      order: ['Timeframe supérieur', 'Le level', 'L\'entry', 'Comment il s\'est terminé'], result: 'Résultat',
      chart: ['L\'échelle des prix', 'L\'axe du temps', 'Le symbole et le timeframe', 'Vos tracés : level, VR, entry, stop, target'], chartT: 'Ce que le desk lit sur une capture',
      formN: ['Images', 'Légendes', 'Vos mots', 'Envoyer'], note: 'Sweep du high M30, puis le VR M5. Sell après le CF, stop au-dessus du VR.',
      answer: 'Un sell après le sweep du high M30. Le VR M5 va du high 3919.5 jusqu\'à 3906.5. Entry après le CF M5, stop au-dessus du VR.',
      key: 'ou la touche', bad: 'Faible', good: 'Bon', yes: 'À faire', no: 'À éviter', check: 'Vérifiez', tip: 'Conseil', warn: 'Attention', right: 'Bonne réponse', wrong: 'Pas celle-ci' } };
  var TUT = { en: EN, fr: FR };
  var chapters = function (l) { return TUT[l] || EN; };
  // where a teacher is in the tutorial, kept per account on the device
  var skey = function (who) { return 'msMoTut:' + (who || ''); };
  function state(who) { try { var v = JSON.parse((root.localStorage && root.localStorage.getItem(skey(who))) || 'null'); if (v && typeof v === 'object') return { at: Math.max(0, Math.min(EN.length - 1, +v.at || 0)), done: !!v.done, ok: v.ok && typeof v.ok === 'object' ? v.ok : {} }; } catch (e) {} return { at: 0, done: false, ok: {} }; }
  function keep(who, st) { try { if (root.localStorage) root.localStorage.setItem(skey(who), JSON.stringify(st)); } catch (e) {} }
  var API = { TUT: TUT, FIG: FIG, chapters: chapters, state: state };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.MS_MOSHA_TUTOR = API;
  if (typeof document === 'undefined') return;

  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var S = { who: '', at: 0, done: false, ok: {}, opt: {}, picked: {} }, F = function () { return FIG[I().lang()] || FIG.en; };

  // ─── the pictures ───
  var num = function (n) { return '<b class="mt-n" aria-hidden="true">' + n + '</b>'; };
  function spark(pts, extra) { return '<svg viewBox="0 0 120 64" aria-hidden="true" focusable="false">' + (extra || '') + '<polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>'; }
  var FIGS = {
    loop: function (f) { return '<ol class="mt-loop">' + f.loop.map(function (s, i) { return '<li>' + num(i + 1) + '<span>' + esc(s) + '</span></li>'; }).join('') + '</ol><p class="mt-cap">↻ ' + esc(f.again) + '</p>'; },
    order: function (f) {
      var pic = [spark('4,14 22,22 34,16 52,30 62,26 84,44 96,40 116,56', '<line x1="4" y1="34" x2="116" y2="34" class="mt-lv"/>'),
        spark('4,44 20,36 34,40 52,24 62,10 70,26 86,34 116,46', '<line x1="4" y1="20" x2="116" y2="20" class="mt-lv"/>'),
        spark('4,30 18,22 30,14 40,24 52,18 62,30 78,46 116,52', '<rect x="26" y="10" width="38" height="24" class="mt-vr"/>'),
        spark('4,14 30,24 52,20 80,40 116,54', '<line x1="4" y1="54" x2="116" y2="54" class="mt-tg"/><line x1="4" y1="8" x2="116" y2="8" class="mt-st"/>')],
        cap = ['H4 BO sell', 'M30 sweep high', 'M5 vr + M5 cf', f.result];
      return '<ol class="mt-order">' + pic.map(function (p, i) { return '<li><span class="mt-thumb">' + p + '</span><b>' + (i + 1) + ' · ' + esc(cap[i]) + '</b><small>' + esc(f.order[i]) + '</small></li>'; }).join('') + '</ol>';
    },
    chart: function (f) {
      var c = [[40, 150, 138], [58, 138, 126], [76, 126, 132], [94, 132, 112], [112, 112, 96], [130, 96, 104], [148, 104, 78], [166, 78, 60], [184, 60, 52], [202, 52, 74], [220, 74, 66], [238, 66, 92], [256, 92, 108], [274, 108, 100], [292, 100, 128], [310, 128, 150], [328, 150, 168]];
      var candles = c.map(function (k) { var up = k[2] < k[1], y = Math.min(k[1], k[2]), h = Math.max(4, Math.abs(k[1] - k[2])); return '<line x1="' + k[0] + '" x2="' + k[0] + '" y1="' + (y - 7) + '" y2="' + (y + h + 7) + '" class="' + (up ? 'mt-up' : 'mt-dn') + '"/><rect x="' + (k[0] - 5) + '" y="' + y + '" width="10" height="' + h + '" class="' + (up ? 'mt-upf' : 'mt-dnf') + '"/>'; }).join('');
      var dot = function (n, x, y) { return '<circle cx="' + x + '" cy="' + y + '" r="11" class="mt-dot"/><text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" class="mt-dott">' + n + '</text>'; };
      return '<figure class="mt-chart"><svg viewBox="0 0 420 236" role="img" aria-label="' + esc(f.chartT) + '"><rect x="1" y="1" width="418" height="234" rx="10" class="mt-bg"/>'
        + '<line x1="366" y1="30" x2="366" y2="200" class="mt-ax"/><line x1="16" y1="200" x2="366" y2="200" class="mt-ax"/>'
        + '<text x="372" y="62" class="mt-tx">3920</text><text x="372" y="114" class="mt-tx">3910</text><text x="372" y="166" class="mt-tx">3900</text>'
        + '<text x="60" y="222" class="mt-tx">06:00</text><text x="176" y="222" class="mt-tx">07:00</text><text x="292" y="222" class="mt-tx">08:00</text>'
        + '<text x="16" y="24" class="mt-tt">XAU/USD · M5</text>'
        + '<line x1="24" y1="68" x2="250" y2="68" class="mt-lv"/><text x="26" y="62" class="mt-tl">M30 high</text>'
        + '<rect x="176" y="44" width="72" height="62" class="mt-vr"/><text x="182" y="100" class="mt-tl">VR</text>' + candles
        + '<line x1="262" y1="40" x2="360" y2="40" class="mt-st"/><text x="300" y="35" class="mt-tl mt-sell">Stop</text>'
        + '<line x1="262" y1="112" x2="360" y2="112" class="mt-en"/><text x="322" y="107" class="mt-tl">Entry</text>'
        + '<line x1="262" y1="184" x2="360" y2="184" class="mt-tg"/><text x="264" y="178" class="mt-tl mt-buy">Target</text>'
        + dot(1, 398, 28) + dot(2, 30, 216) + dot(3, 150, 19) + dot(4, 160, 92) + '</svg>'
        + '<figcaption><ol class="mt-legend">' + f.chart.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></figcaption></figure>';
    },
    form: function (f) {
      return '<div class="mt-mock" aria-hidden="true"><div class="mt-m-drop">' + num(1) + '<span class="mt-m-btn">' + esc(T('Choose screenshots')) + '</span></div>'
        + '<div class="mt-m-row">' + num(2) + '<span class="mt-thumb mt-thumb-s">' + spark('4,44 20,36 34,40 52,24 62,10 70,26 86,34 116,46', '<line x1="4" y1="20" x2="116" y2="20" class="mt-lv"/>') + '</span><span class="mt-m-in">M30 sweep high</span></div>'
        + '<div class="mt-m-chips"><i>H4</i><i>H1</i><i class="on">M30 sweep high</i><i>M5 vr</i><i>M5 cf for sell</i></div>'
        + '<div class="mt-m-row">' + num(3) + '<span class="mt-m-in mt-m-ta">' + esc(f.note) + '</span></div>'
        + '<div class="mt-m-row">' + num(4) + '<span class="mt-m-btn mt-m-pri">' + esc(T('Send to the desk')) + '</span></div></div>';
    },
    answer: function (f) {
      return '<div class="mt-mock" aria-hidden="true"><div class="mt-m-ans"><b>' + esc(T('The desk understood')) + '</b><p>' + esc(f.answer) + '</p></div>'
        + '<div class="mt-m-row"><span class="mt-m-q">' + esc(T('Did the desk get it right?')) + '</span><span class="mt-m-btn mt-m-yes">' + esc(T('That is right')) + '</span><span class="mt-m-btn">' + esc(T('Not right…')) + '</span></div></div>';
    },
    book: function () {
      return '<div class="mt-mock" aria-hidden="true"><div class="mt-m-line"><p>' + esc(T('CF: a candle that closes out of the VR. A close below it is the CF for a sell, a close above it the CF for a buy.')) + '</p><span class="mt-m-chip">' + esc(T('The desk\'s reading, not confirmed')) + '</span></div>'
        + '<div class="mt-m-row"><span class="mt-m-btn mt-m-yes">' + esc(T('Right')) + '</span><span class="mt-m-btn">' + esc(T('Correct')) + '</span><span class="mt-m-btn">' + esc(T('Erase')) + '</span></div></div>';
    },
    chip: function (f) {
      return '<div class="mt-mock mt-m-replay" aria-hidden="true"><span class="mt-thumb mt-thumb-w">' + spark('4,20 20,14 34,24 50,18 66,34 82,30 98,48 116,52', '<line x1="4" y1="52" x2="116" y2="52" class="mt-tg"/><line x1="4" y1="8" x2="116" y2="8" class="mt-st"/>') + '</span>'
        + '<div class="mt-m-row"><span class="mt-m-pill">' + esc(T('Teach this trade')) + ' <b>+2R</b> <i>×</i></span><span class="mt-m-q">' + esc(f.key) + '</span><kbd>T</kbd></div></div>';
    }
  };

  // ─── a chapter ───
  function blockHTML(b, f) {
    if (b.p) return '<p>' + esc(b.p) + '</p>';
    if (b.h) return '<h3>' + esc(b.h) + '</h3>';
    if (b.ul) return '<ul>' + b.ul.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (b.ol) return '<ol class="mt-steps">' + b.ol.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>';
    if (b.tip) return '<p class="mt-tip"><b>' + esc(f.tip) + '</b> ' + esc(b.tip) + '</p>';
    if (b.warn) return '<p class="mt-tip mt-warn"><b>' + esc(f.warn) + '</b> ' + esc(b.warn) + '</p>';
    if (b.fig) return '<div class="mt-fig">' + FIGS[b.fig](f) + '</div>';
    if (b.cmp) { var fix = b.cmp.kind === 'fix', side = function (x, good) { return '<div class="mt-cmp-' + (good ? 'good' : 'bad') + '"><b>' + (good ? '✓ ' : '✕ ') + esc(fix ? T(good ? 'A good correction' : 'A weak correction') : T(good ? 'Easy to learn from' : 'Hard to learn from')) + '</b>'
        + (x.pics ? '<dl><dt>' + esc(T('Pictures')) + '</dt><dd>' + esc(x.pics) + '</dd><dt>' + esc(T('Your words')) + '</dt><dd>' + esc(x.words) + '</dd></dl>' : '<p class="mt-q">' + esc(x.words) + '</p>') + '<p class="mt-why">' + esc(x.why) + '</p></div>'; };
      return '<div class="mt-cmp">' + side(b.cmp.bad, false) + side(b.cmp.good, true) + '</div>'; }
    if (b.dd) { var col = function (xs, good) { return '<div class="mt-cmp-' + (good ? 'good' : 'bad') + '"><b>' + (good ? '✓ ' : '✕ ') + esc(good ? f.yes : f.no) + '</b><ul>' + xs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; };
      return '<div class="mt-cmp">' + col(b.dd.yes, true) + col(b.dd.no, false) + '</div>'; }
    return '';
  }
  function quizHTML(c, f) {
    if (!c.quiz) return ''; var pick = S.picked[c.k];
    return '<section class="mt-quiz" aria-live="polite"><h3>' + esc(f.check) + '</h3><p class="mt-quiz-q">' + esc(c.quiz.q) + '</p><div class="mt-quiz-o">' + c.quiz.o.map(function (o, i) {
      return '<button type="button" data-q="' + i + '" class="' + (pick === i ? (o.ok ? 'ok' : 'no') : '') + '" aria-pressed="' + (pick === i) + '"><span>' + esc(o.t) + '</span>' + (pick === i ? '<small><b>' + esc(o.ok ? f.right : f.wrong) + '.</b> ' + esc(o.why) + '</small>' : '') + '</button>'; }).join('') + '</div></section>';
  }
  function draw() {
    var d = document.getElementById('mo-tut'); if (!d) return; var l = I().lang(), cs = chapters(l), c = cs[S.at], f = F(), last = S.at === cs.length - 1;
    d.setAttribute('lang', l); d.querySelector('.mt-title').textContent = T('How to work with the desk'); d.querySelector('.mt-x').setAttribute('aria-label', T('Close the tutorial'));
    d.querySelector('.mt-lang').innerHTML = I().LANGS.map(function (k) { return '<button type="button" data-lang="' + k + '" aria-pressed="' + (l === k) + '" lang="' + k + '">' + I().NAMES[k] + '</button>'; }).join('');
    d.querySelector('.mt-nav').innerHTML = '<h3>' + esc(T('Chapters')) + '</h3><ol>' + cs.map(function (x, i) { return '<li><button type="button" data-at="' + i + '"' + (i === S.at ? ' aria-current="step"' : '') + '><i aria-hidden="true">' + (S.ok[x.k] || (S.done && !x.quiz) ? '✓' : i + 1) + '</i><span>' + esc(x.t) + '</span></button></li>'; }).join('') + '</ol>';
    d.querySelector('.mt-main').innerHTML = '<p class="mt-count">' + esc(T('Chapter {a} of {b}', { a: S.at + 1, b: cs.length })) + '</p><h2 tabindex="-1">' + esc(c.t) + '</h2><p class="mt-lead">' + esc(c.lead) + '</p>'
      + c.body.map(function (b) { return blockHTML(b, f); }).join('') + quizHTML(c, f)
      + (c.go ? '<p class="mt-go">' + (c.go.href ? '<a class="ms-tbtn" href="' + esc(c.go.href) + '">' + esc(c.go.label) + '</a>' : '<button type="button" class="' + (last ? 'u-btn' : 'ms-tbtn') + '" data-go="' + esc(c.go.k) + '">' + esc(c.go.label) + '</button>') + '</p>' : '');
    d.querySelector('.mt-bar i').style.width = Math.round(100 * (S.at + 1) / cs.length) + '%';
    var back = d.querySelector('[data-step="-1"]'), next = d.querySelector('[data-step="1"]'); back.textContent = T('Back'); back.disabled = S.at === 0; next.textContent = last ? T('Finish') : T('Next');
  }
  function go(i, focus) { var n = chapters(I().lang()).length; S.at = Math.max(0, Math.min(n - 1, i)); if (S.at === n - 1) S.done = true; keep(S.who, { at: S.at, done: S.done, ok: S.ok }); draw();
    var d = document.getElementById('mo-tut'), m = d && d.querySelector('.mt-main'); if (m) { m.scrollTop = 0; if (focus) { var h = m.querySelector('h2'); if (h) h.focus({ preventScroll: true }); } } }
  function close() { var d = document.getElementById('mo-tut'); if (d && d.open) d.close(); }
  function open(who, opt) {
    var st = state(who); S.who = who || ''; S.at = st.done ? 0 : st.at; S.done = st.done; S.ok = st.ok; S.opt = opt || {}; S.picked = {};
    var d = document.getElementById('mo-tut');
    if (!d) { d = document.createElement('dialog'); d.id = 'mo-tut'; d.className = 'mo-tut'; d.setAttribute('aria-labelledby', 'mo-tut-t');
      d.innerHTML = '<header class="mt-head"><b class="mt-title" id="mo-tut-t"></b><span class="mt-lang mo-lang" role="group" aria-label="Language / Langue"></span><button type="button" class="mt-x">×</button><div class="mt-bar" aria-hidden="true"><i></i></div></header>'
        + '<nav class="mt-nav" aria-label="Chapters"></nav><article class="mt-main"></article><footer class="mt-foot"><button type="button" class="ms-tbtn" data-step="-1"></button><button type="button" class="u-btn" data-step="1"></button></footer>';
      document.body.appendChild(d);
      d.addEventListener('click', function (ev) { var b = ev.target.closest('button'); if (!b) return;
        if (b.classList.contains('mt-x')) close();
        else if (b.dataset.lang) { if (S.opt.onLang) S.opt.onLang(b.dataset.lang); else I().set(b.dataset.lang, S.who); draw(); }
        else if (b.dataset.at) go(+b.dataset.at, true);
        else if (b.dataset.step) { if (+b.dataset.step > 0 && S.at === chapters(I().lang()).length - 1) { S.done = true; keep(S.who, { at: 0, done: true, ok: S.ok }); close(); } else go(S.at + (+b.dataset.step), true); }
        else if (b.dataset.q) { var c = chapters(I().lang())[S.at], i = +b.dataset.q; S.picked[c.k] = i; if (c.quiz.o[i].ok) { S.ok[c.k] = true; keep(S.who, { at: S.at, done: S.done, ok: S.ok }); } var top = d.querySelector('.mt-main').scrollTop; draw(); d.querySelector('.mt-main').scrollTop = top; var nb = d.querySelector('.mt-quiz-o button[data-q="' + i + '"]'); if (nb) nb.focus({ preventScroll: true }); }
        else if (b.dataset.go) { var k = b.dataset.go; S.done = S.done || S.at === chapters(I().lang()).length - 1; keep(S.who, { at: S.at, done: S.done, ok: S.ok }); close(); if (S.opt.go) setTimeout(function () { S.opt.go(k); }, 60); } });
      d.addEventListener('keydown', function (ev) { if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName) || ev.altKey || ev.ctrlKey || ev.metaKey) return; if (ev.key === 'ArrowRight') { ev.preventDefault(); go(S.at + 1, true); } else if (ev.key === 'ArrowLeft') { ev.preventDefault(); go(S.at - 1, true); } });
      d.addEventListener('close', function () { keep(S.who, { at: S.at, done: S.done, ok: S.ok }); if (S.opt.onClose) S.opt.onClose(); });
    }
    draw(); if (d.showModal) d.showModal(); else d.setAttribute('open', ''); var h = d.querySelector('.mt-main h2'); if (h) h.focus({ preventScroll: true });
  }
  API.open = open; API.close = close;
})(typeof window !== 'undefined' ? window : globalThis);
