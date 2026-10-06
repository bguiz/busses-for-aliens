// Route planner: direct bus, or one transfer. Pure functions over window.STOPS / window.SERVICES.
(function (root) {
  const STOPS = root.STOPS, SERVICES = root.SERVICES;
  const TRANSFER_PENALTY = 10; // stop-equivalents; humans dislike transfers
  const WALK_PER_STOP = 100;   // metres of walking that cost about the same as one stop of riding

  const routes = [];           // {no, dir, stops:[code]}
  const stopRoutes = new Map(); // code -> [[routeId, indexInRoute]]
  for (const [no, dirs] of Object.entries(SERVICES)) {
    dirs.forEach((stops, dir) => {
      const id = routes.length;
      routes.push({ no, dir, stops });
      stops.forEach((code, i) => {
        if (!stopRoutes.has(code)) stopRoutes.set(code, []);
        stopRoutes.get(code).push([id, i]);
      });
    });
  }

  function distM(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const stopPos = code => { const s = STOPS[code]; return s ? { lat: s[1], lng: s[0] } : null; };

  // Nearest stops (that have at least one service) to a lat/lng.
  function nearestStops(lat, lng, count = 8) {
    const out = [];
    for (const code in STOPS) {
      if (!stopRoutes.has(code)) continue;
      const s = STOPS[code];
      out.push({ code, dist: distM(lat, lng, s[1], s[0]) });
    }
    out.sort((a, b) => a.dist - b.dist);
    return out.slice(0, count);
  }

  // Best ride from one stop to any stop in destSet. Returns {legs, cost} or null.
  function ride(origin, destSet) {
    let best = null;
    for (const [rid, i] of stopRoutes.get(origin) || []) {
      const st = routes[rid].stops;
      for (let j = i + 1; j < st.length; j++) {
        if (destSet.has(st[j])) {
          const cost = j - i;
          if (!best || cost < best.cost) best = { cost, legs: [{ rid, from: i, to: j }] };
          break;
        }
      }
    }
    if (best) return best;
    for (const [rid, i] of stopRoutes.get(origin) || []) {
      const st = routes[rid].stops;
      for (let j = i + 1; j < st.length; j++) {
        for (const [rid2, k] of stopRoutes.get(st[j]) || []) {
          if (rid2 === rid || routes[rid2].no === routes[rid].no) continue;
          const st2 = routes[rid2].stops;
          for (let m = k + 1; m < st2.length; m++) {
            if (destSet.has(st2[m])) {
              const cost = (j - i) + (m - k) + TRANSFER_PENALTY;
              if (!best || cost < best.cost)
                best = { cost, legs: [{ rid, from: i, to: j }, { rid: rid2, from: k, to: m }] };
              break;
            }
          }
        }
      }
    }
    return best;
  }

  // origins: [{code, dist}] candidate boarding stops, place: {lat,lng,stops:[code]}
  function plan(origins, place) {
    const destSet = new Set(place.stops);
    let best = null;
    for (const o of origins) {
      if (destSet.has(o.code)) return { here: true, origin: o, dest: o.code, legs: [], walkIn: o.dist, walkOut: stopWalk(o.code, place) };
      const r = ride(o.code, destSet);
      if (!r) continue;
      const lastLeg = r.legs[r.legs.length - 1];
      const dest = routes[lastLeg.rid].stops[lastLeg.to];
      const walkOut = stopWalk(dest, place);
      const score = r.cost + (o.dist + walkOut) / WALK_PER_STOP;
      if (!best || score < best.score) best = { score, origin: o, dest, legs: r.legs, walkIn: o.dist, walkOut };
    }
    return best;
  }

  const stopWalk = (code, place) => { const p = stopPos(code); return p ? distM(p.lat, p.lng, place.lat, place.lng) : 0; };

  const api = { routes, stopRoutes, distM, stopPos, nearestStops, ride, plan };
  root.Planner = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
