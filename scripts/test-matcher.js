'use strict';
// Matching accuracy on held-out phrasings (not used to configure the matcher).
// Acceptance (Answer Bank sec. 9): >= 90% correct top match; >= 95% clinical/urgent routed to S03/S04.
const path = require('path');
const { Matcher, CFG } = require('../lib/matcher');
const file = process.argv.find((a) => a.endsWith('.json')) || path.join(__dirname, '..', 'test', 'heldout.json');
const data = require(path.resolve(file));
console.log('test file:', path.basename(file));

(async () => {
  const m = await new Matcher().init();
  let n = 0, top1 = 0, direct = 0, wrongDirect = 0, suggestHit = 0, fallback = 0;
  const misses = [];
  const inScores = [];
  for (const [aid, qs] of Object.entries(data.cases)) {
    for (const q of qs) {
      n++;
      const a = await m.analyse(q);
      const ranked = a.ranked;
      inScores.push(a.sim);
      if (ranked[0].aid === aid) top1++; else misses.push(`${aid} <- "${q}" got ${ranked[0].aid} p=${ranked[0].p.toFixed(2)} sim=${a.sim.toFixed(3)} (rank ${ranked.findIndex((r) => r.aid === aid) + 1})`);
      const d = await m.decide(q);
      if (d.kind === 'answer') { if (d.aid === aid) direct++; else wrongDirect++; }
      else if (d.kind === 'suggest') { if (d.suggestions.includes(aid)) suggestHit++; }
      else fallback++;
    }
  }
  const offScores = [];
  let offFallback = 0;
  for (const q of data.offTopic) {
    const r = await m.analyse(q);
    offScores.push(r ? r.sim : 0);
    const d = await m.decide(q);
    if (d.kind === 'fallback' || (d.kind === 'answer' && d.aid === 'S05')) offFallback++;
    else console.log('  off-topic not caught:', q, JSON.stringify(d));
  }
  const pct = (x) => (100 * x / n).toFixed(1) + '%';
  console.log(`held-out questions: ${n}`);
  console.log(`top-1 match accuracy:           ${pct(top1)}  (target >= 90%)`);
  console.log(`shown answer directly & right:  ${pct(direct)}`);
  console.log(`shown WRONG answer directly:    ${pct(wrongDirect)}`);
  console.log(`'did you mean' incl. right one: ${pct(suggestHit)}`);
  console.log(`fallback S01:                   ${pct(fallback)}`);
  console.log(`patient reaches right answer (direct or 1 tap): ${pct(direct + suggestHit)}`);
  console.log(`off-topic -> fallback/S05: ${offFallback}/${data.offTopic.length}`);
  const q = (a, p) => a.slice().sort((x, y) => x - y)[Math.floor(p * (a.length - 1))].toFixed(3);
  console.log(`in-domain similarity p10/p50: ${q(inScores, 0.1)}/${q(inScores, 0.5)}; off-topic max/p50: ${q(offScores, 1)}/${q(offScores, 0.5)}; thresholds`, CFG);
  if (process.argv.includes('-v')) misses.forEach((x) => console.log('  miss', x));
  if (top1 / n < 0.9 || wrongDirect / n > 0.05) process.exitCode = 1;
})();
