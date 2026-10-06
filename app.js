(() => {
  const STOPS = window.STOPS, PLACES = window.PLACES, GL = window.SGA, P = window.Planner, CREDITS = window.CREDITS || {};
  const API = 'https://arrivelah2.busrouter.sg/?id=';
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- Shikadi rendering: each a-z letter becomes a glyph; everything else stays as-is ----------
  function sga(text) {
    return text.split(/(\s+)/).map(w => {
      if (/^\s+$/.test(w)) return ' ';
      const letters = [...w].map(ch => {
        const g = GL[ch.toLowerCase()];
        return g
          ? `<svg class="g" viewBox="${g.x} 0 ${g.w} 13" style="--r:${(g.w / 13).toFixed(3)}" aria-hidden="true"><path d="${g.p}"/></svg>`
          : esc(ch);
      }).join('');
      return `<span class="w">${letters}</span>`;
    }).join('');
  }
  // Every piece of user-facing text goes through t(): Singlish line + Shikadi line, always both.
  const t = (text, cls = '') => `<span class="bi ${cls}"><span class="en">${esc(text)}</span><span class="sga" aria-hidden="true">${sga(text)}</span></span>`;

  // ---------- Copy (voice: a Choa Chu Kang auntie who has seen everything) ----------
  const GUIDE = [
    { title: 'Bus basics: what is this thing?', body: [
      'Bus is big box on wheels, everybody share one. Everybody go in, everybody pay, everybody pretend never see each other. Very efficient, abuden.',
      'Bus stop is a pole with a sign by the road. Yes, that one only. No landing pad, no forcefield, walao eh. The sign got 5-digit stop code and all the bus numbers that stop there.',
      'Service number is the bus route, like 12 or 960. Same number can run two direction, so check where it go first. Board the wrong one, you see whole island for nothing, sian.',
      'Bus only stop if got people want on or off. Want to board, stick your hand out, flag it down. Humans call this "waving". Bus cannot read mind one, you know?'] },
    { title: 'Reading the bus data', glossary: true },
    { title: 'Etiquette: how not to kena stare', body: [
      'Queue at the stop. Let people get off first, then you go on. Humans take this very serious. Cut queue, they stare you until you die.',
      'Seat with priority sign is for old people, pregnant lady, injured people, and mama with baby. Not those, then don\'t sit lah. You can say "culture shock injury", but nobody will agree, confirm.',
      'No eat, no drink, no durian. Yes, got rule for durian. Humans know their own smell weapon, steady.',
      'Keep your voice down. Humans eyes stuck on phone, ears stuck on earphone. Want to talk, whisper only. No telepathy, buay tahan.',
      'Press bell before your stop. Go "ding", bus will stop. Only time humans happy to be pushed button by you, hor.'] },
    { title: 'Paying: tap, tap, done', body: [
      'Humans pay by tap card or phone on the round reader near the door. Tap when board, tap again when get off. Fare depends how far you go, so forget tap out is jialat, they charge you the max, aiyoh.',
      'Any contactless bank card can, also the local transit card. Cash got some bus still take, but no change. Just tap lah, don\'t be like that.',
      'Change bus within 45 minutes, system give you small rebate. Humans love rebate. We don\'t understand, but respect.'] },
    { title: 'Singapore basics for people just landed', body: [
      'Hot. Humid. Always hot and humid, sibei. Inside the aircon is freezing on purpose, so every 10 minutes you go from sweat to ice. Bring jacket, wear t-shirt, accept the contradiction.',
      'Rain suddenly come, suddenly go. Bring umbrella. Bus stop got roof, that is why it exist, you know?',
      'People speak English, and also Singlish, which is English with extra words. "Can" is yes. "Cannot" is no. "Lah" is "I am emphasising something obvious". "Aiyoh" is "oh no". "Shiok" is "very nice".',
      'Very clean, and the fine is real. No chewing gum, no litter, no spit. Human say "fine city", that one is joke and also warning, hor.',
      'Hawker centre is open-air food court. Choose stall, pay, then find seat. See tissue packet on table, means table taken. Tissue packet is strongest forcefield on earth. This one called "chope".'] }
  ];
  const GLOSSARY = [
    ['Arr', 'Arriving. Less than one minute. Don\'t go anywhere, hor.'],
    ['5 min', 'How many minute until the bus reach your stop. Humans call it "prediction". Mostly right lah, mostly.'],
    ['SEA', 'Seats available. Sit down, rest your tentacle.'],
    ['SDA', 'Standing available. Seat all taken, but can stand. Hold pole.'],
    ['LSD', 'Limited standing. Packed like sardine. You might like it, who knows.'],
    ['WAB', 'Wheelchair accessible bus. Got ramp, got space inside.'],
    ['SD', 'Single deck. Normal bus, one floor.'],
    ['DD', 'Double deck. Two floor. Go upstairs, view shiok.'],
    ['BD', 'Bendy bus. Two body join by rubber accordion. Don\'t panic, it won\'t bite.'],
    ['Opp', 'Opposite. Other side of the road. Check which side you want, please.'],
    ['Bef / Aft', 'Before / After. The stop before or after a landmark.'],
    ['Stn', 'Station. Usually MRT, the underground and elevated train.'],
    ['Int / Ter', 'Interchange / Terminal. Where many bus start or end. Damn busy.'],
    ['Blk', 'Block. Tall residential building, got number.']
  ];
  const ABBR = { Opp: 'opposite, means across the road', Bef: 'before', Aft: 'after', Stn: 'station', Int: 'interchange', Ter: 'terminal', Blk: 'block', Gdns: 'gardens', Lk: 'link', Ctr: 'centre', Natl: 'national', Lib: 'library', Hosp: 'hospital', Pk: 'park' };
  const LOAD = { SEA: 'Got seat lah', SDA: 'No seat but can stand', LSD: 'Sibei squeeze, stand also tight' };
  const TYPE = { SD: 'single deck', DD: 'double deck', BD: 'bendy bus' };
  const SITES = [
    ['Changi Airport T3', 1.3564, 103.9886],
    ['Marina Bay Sands', 1.2834, 103.8607],
    ['Orchard Road', 1.3044, 103.8318],
    ['Jurong East', 1.3331, 103.7423],
    ['Punggol', 1.4052, 103.9023]
  ];

  // ---------- State ----------
  let origin = null;       // {lat, lng, candidates:[{code, dist}], label}
  let refreshTimer = null;
  const arrCache = new Map();

  // ---------- Shared bits ----------
  const stopName = code => (STOPS[code] ? STOPS[code][2] : code);
  const stopRoad = code => (STOPS[code] ? STOPS[code][3] : '');
  const round10 = m => (m < 100 ? Math.max(10, Math.round(m / 10) * 10) : Math.round(m / 50) * 50);
  function gloss(name) {
    const hits = name.split(/[\s/]+/).filter(w => ABBR[w]).map(w => `"${w}" means ${ABBR[w]}`);
    return hits.length ? ' (' + hits.join('; ') + ')' : '';
  }
  const stopLabel = code => `${stopName(code)}, ${stopRoad(code)}`;
  const photo = (p, cls) => `<img class="${cls}" src="img/${p.id}.jpg" alt="Photo of ${esc(p.real || p.name)}" loading="lazy" width="640" height="420">`;

  // ---------- Screens ----------
  function renderHeader() {
    $('#title').innerHTML = t('Take Me To Your Bus Stop');
    $('#subtitle').innerHTML = t('Singapore bus guide for first-time visitor from outer space. Don\'t worry lah, humans also confuse one.');
    $('#foot').innerHTML = t('Bus timing from ArriveLah. Route from BusRouter SG. Photos from Wikipedia and Wikimedia Commons. Stop and place all real, story not real. Take care, hor.');
  }

  function renderWhere(status) {
    const sitesHtml = SITES.map((s, i) => `<button class="btn ghost" data-site="${i}">${t(s[0])}</button>`).join('');
    $('#s-where').innerHTML = `
      <h2>${t('Step 1: Where you land?')}</h2>
      <p class="muted">${t('You also don\'t know, right? Never mind lah. Let the phone tell us, it always know one.')}</p>
      <div class="row"><button class="btn" id="btn-gps">${t('Use my location')}</button></div>
      <details style="margin-top:12px"><summary>${t('Location cannot work? Do it the old-school way.')}</summary><div>
        <p class="muted">${t('Look at the bus stop pole. Got 5-digit number on it. Type here.')}</p>
        <form class="where-input" id="form-code">
          <input id="in-code" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="e.g. 09047" aria-label="Bus stop code">
          <button class="btn" type="submit">${t('Use this stop')}</button>
        </form>
        <p class="muted" style="margin-top:12px">${t('Or just say you land at one of these, where humans always land:')}</p>
        <div class="row">${sitesHtml}</div>
      </div></details>
      ${status ? `<div class="status ${status.err ? 'err' : ''}">${status.html}</div>` : ''}`;
    $('#btn-gps').onclick = useGps;
    $('#form-code').onsubmit = e => { e.preventDefault(); useCode($('#in-code').value.trim()); };
    document.querySelectorAll('[data-site]').forEach(b => b.onclick = () => {
      const s = SITES[+b.dataset.site];
      setOrigin(s[1], s[2], s[0]);
    });
  }

  function useGps() {
    if (!navigator.geolocation) return renderWhere({ err: true, html: t('Aiyoh, this browser got no location feature. Even our ship got one. Type the stop code lah.') });
    renderWhere({ html: t('Asking the satellite... wait ah, sometimes they slow one.') });
    navigator.geolocation.getCurrentPosition(
      pos => setOrigin(pos.coords.latitude, pos.coords.longitude, 'your location'),
      () => renderWhere({ err: true, html: t('Alamak, location cannot get. Maybe you press no, maybe permission paiseh. Type the stop code, or pick one landing place below.') }),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }

  function useCode(code) {
    if (!STOPS[code] || !P.stopRoutes.has(code)) {
      return renderWhere({ err: true, html: t('No such bus stop leh. Check the 5-digit number on the pole again. Alien and typo, classic combo.') });
    }
    const [lng, lat] = STOPS[code];
    origin = { lat, lng, candidates: [{ code, dist: 0 }], label: stopName(code) };
    afterOrigin();
  }

  function setOrigin(lat, lng, label) {
    const near = P.nearestStops(lat, lng, 8);
    if (!near.length) return renderWhere({ err: true, html: t('No bus stop anywhere near. You in the sea ah? Humans cannot help you there.') });
    origin = { lat, lng, candidates: near, label };
    afterOrigin();
  }

  function afterOrigin() {
    const near = origin.candidates[0];
    renderWhere({ html:
      t(`Okay, got you. Nearest bus stop is ${stopLabel(near.code)}, about ${round10(near.dist)} m away.`) +
      (near.dist > 1500 ? t('Walao, far lah. Humans take taxi for this one. Not spaceship.', 'inline') : '') });
    $('#s-pick').hidden = false;
    $('#s-journey').hidden = true;
    renderPick();
    $('#s-pick').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function placeCard(p) {
    return `<button class="place" data-place="${p.id}">
      ${photo(p, 'thumb')}
      <div class="pbody"><div class="name">${t(p.name)}</div>
      <div class="blurb">${t(p.blurb)}</div></div></button>`;
  }
  function renderPick() {
    $('#s-pick').innerHTML = `
      <h2>${t('Step 2: Where you want go?')}</h2>
      <p class="muted">${t('Cannot decide? Just pick one lah. Humans also don\'t know what to eat every day. All these very normal places one, don\'t think too much.')}</p>
      <div class="grid">${PLACES.map(placeCard).join('')}</div>`;
    document.querySelectorAll('[data-place]').forEach(b => b.onclick = () => showJourney(b.dataset.place));
  }

  // ---------- Live arrivals ----------
  async function getArrivals(code) {
    const hit = arrCache.get(code);
    if (hit && Date.now() - hit.at < 10000) return hit.data;
    const res = await fetch(API + code);
    if (!res.ok) throw new Error('bad status ' + res.status);
    const data = await res.json();
    arrCache.set(code, { at: Date.now(), data });
    return data;
  }
  function arrivalRows(data, no) {
    const svc = (data.services || []).find(s => s.no === no);
    if (!svc) return t('No data for this bus leh. Maybe it go tea break, maybe not running now. Humans also don\'t know.');
    const seen = new Set(), list = [];
    for (const k of ['next', 'subsequent', 'next2', 'next3']) {
      const b = svc[k];
      if (b && b.time && !seen.has(b.time)) { seen.add(b.time); list.push(b); }
    }
    if (!list.length) return t('No bus coming. Either late at night, or bus give up already. It happens, lah.');
    return list.slice(0, 3).map(b => {
      const mins = Math.round((b.duration_ms || 0) / 60000);
      const m = mins <= 1 ? 'Arr' : String(mins);
      const parts = [LOAD[b.load] || 'Cannot tell how full', TYPE[b.type] || '', b.feature === 'WAB' ? 'wheelchair can go' : ''].filter(Boolean);
      const desc = parts.join(', ') + '.' + (m === 'Arr' ? ' Don\'t go anywhere hor.' : '');
      return `<div class="arrow"><div class="mins">${m}${m === 'Arr' ? '' : '<small>min</small>'}</div><div>${t(desc)}</div></div>`;
    }).join('');
  }
  async function refreshArrivals() {
    for (const el of document.querySelectorAll('.arr[data-code]')) {
      try { el.innerHTML = arrivalRows(await getArrivals(el.dataset.code), el.dataset.no); }
      catch (e) { el.innerHTML = `<div class="status err">${t('Cannot reach the bus oracle now. Wifi problem ah? Even alien got wifi problem.')}</div>`; }
    }
  }

  // ---------- Journey ----------
  function showJourney(placeId) {
    const place = PLACES.find(p => p.id === placeId);
    const plan = P.plan(origin.candidates, place);
    clearInterval(refreshTimer);
    $('#s-journey').hidden = false;
    $('#s-pick').hidden = true;

    const credit = CREDITS[place.id] ? `<a class="credit" href="${CREDITS[place.id]}" target="_blank" rel="noopener">${t('Photo: Wikimedia Commons', 'inline')}</a>` : '';
    const head = `<div class="back"><button class="btn ghost" id="btn-back">${t('Back to all places')}</button></div>
      <figure class="hero">${photo(place, 'heroimg')}<figcaption>${credit}</figcaption></figure>
      <h2>${t('Step 3: Your trip to ' + place.name)}</h2>
      <p>${t(place.blurb)}</p>`;

    if (!plan) {
      $('#s-journey').innerHTML = head + `<div class="status err">${t('Walao, no bus plan with one transfer or less from here. Island so small, but this one a bit far. Try MRT (faster), or taxi, or pick another landing place and destination.')}</div>`;
    } else {
      $('#s-journey').innerHTML = head + `<ol class="steps">${buildSteps(plan, place).map(s =>
        `<li class="step"><h3>${t(s.title)}</h3>${s.body ? `<div>${t(s.body)}</div>` : ''}${s.extra || ''}${s.note ? `<div class="note">${t(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
      refreshArrivals();
      refreshTimer = setInterval(refreshArrivals, 15000);
    }
    $('#btn-back').onclick = () => { clearInterval(refreshTimer); $('#s-journey').hidden = true; $('#s-pick').hidden = false; $('#s-pick').scrollIntoView(); };
    $('#s-journey').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function buildSteps(plan, place) {
    const steps = [];
    const o = plan.origin.code;
    const arr = (code, no) => `<div class="arr" data-code="${code}" data-no="${esc(no)}">${t('Checking with the bus oracle...')}</div>`;

    if (plan.here) {
      steps.push({ title: 'You already here lah', body: `The nearest stop (${stopLabel(o)}) is the stop for this place. You travel zero kilometre. Wah, so power, in a lazy way.`, note: 'Walk. Use your leg. The two thing at the bottom.' });
    } else {
      steps.push({
        title: `Walk to the bus stop: ${stopName(o)}`,
        body: `Walk about ${round10(plan.walkIn)} m, as the spaceship fly, to ${stopLabel(o)}. Stop code is ${o}, the sign on the pole got this number.${gloss(stopName(o))}`,
        note: 'Bus stop is a pole with a sign. Yes, really. If got roof, you found the premium one, steady.' });

      plan.legs.forEach((leg, li) => {
        const r = P.routes[leg.rid], boardCode = r.stops[leg.from], alightCode = r.stops[leg.to];
        const term = r.stops[r.stops.length - 1];
        const stopsRidden = leg.to - leg.from;
        const list = r.stops.slice(leg.from, leg.to + 1);
        const first = li === 0;

        steps.push({
          title: `Wait for bus ${r.no}`,
          body: `${first ? '' : `At ${stopLabel(boardCode)}, `}Look out for bus ${r.no}, going towards ${stopName(term)}. Check the number and direction at the front of the bus, don\'t simply board.`,
          extra: arr(boardCode, r.no),
          note: first ? `See bus ${r.no} come, stick your hand out. This is how you tell it you exist. Don\'t wave, it ignore you, like many humans do.` : 'Same thing as before. Wave lah. Bus still cannot read mind.' });

        steps.push({
          title: 'Board and tap your card',
          body: 'Go in from the front door. Tap card or phone on the round reader near the driver. Tap in once only. Tap two times, everybody confuse.',
          note: 'Contactless bank card can. Local transit card also can. Only got alien money, driver say "aiyoh". Not a good sign, I tell you.' });

        steps.push({
          title: `Ride ${stopsRidden} stop${stopsRidden === 1 ? '' : 's'}`,
          body: `Stay on bus ${r.no} for ${stopsRidden} stop${stopsRidden === 1 ? '' : 's'}, then get off at ${stopLabel(alightCode)}.${gloss(stopName(alightCode))}`,
          extra: `<ol class="stoplist">${list.map((c, i) => `<li class="${i === 0 || i === list.length - 1 ? 'hl' : ''}">${esc(stopName(c))}${i === 0 ? ' (you board)' : i === list.length - 1 ? ' (you get off)' : ''}</li>`).join('')}</ol>`,
          note: 'Hold the pole, hor. Bus don\'t wait for you to find your balance. Press bell one stop before yours, go "ding". Everybody will look. Normal one, don\'t paiseh.' });

        const last = li === plan.legs.length - 1;
        steps.push({
          title: last ? `Get off at ${stopName(alightCode)}` : `Get off at ${stopName(alightCode)} and change bus`,
          body: last
            ? 'Go out from the middle or back door, and tap your card on the reader when you get off. Yes, tap again. That is how system know how far you go.'
            : 'Tap out when you leave. Then board the next bus quick: tap in again within 45 minutes, system count as transfer and give you small rebate. Humans love rebate.',
          note: last ? 'Forget tap out? They charge you maximum fare. Humans call it "lesson learned".' : 'Don\'t go drink bubble tea in between. 45 minutes rule one, no negotiate.' });
      });
    }

    steps.push({
      title: `Walk to ${place.name}`,
      body: place.real
        ? `From the stop, walk about ${round10(plan.walkOut)} m. Look for the signboard that say: ${place.real}.`
        : `From the stop, walk about ${round10(plan.walkOut)} m to ${place.name}.`,
      note: 'Look up for signboard. Cannot read, ask a human. Humans like to help, as long as you don\'t ask in wrong language.' });
    return steps;
  }

  // ---------- Guide ----------
  function renderGuide() {
    const items = GUIDE.map(g => {
      const inner = g.glossary
        ? `<p>${t('When you check bus timing, you will see all these. Memorise, or ask a human. Better don\'t ask human.')}</p>
           <table class="glossary"><tbody>${GLOSSARY.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${t(v)}</td></tr>`).join('')}</tbody></table>`
        : g.body.map(p => `<p>${t(p)}</p>`).join('');
      return `<details><summary>${t(g.title)}</summary><div>${inner}</div></details>`;
    }).join('');
    $('#s-guide').innerHTML = `<h2>${t('Field guide: things humans think very obvious')}</h2>${items}`;
  }

  // ---------- Boot ----------
  renderHeader();
  renderWhere();
  renderGuide();
})();
