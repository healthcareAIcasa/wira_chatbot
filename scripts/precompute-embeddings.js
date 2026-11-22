'use strict';
// Builds data/embeddings.json: embeddings of every approved/configuration example question
// plus the trained answer-choice classifier. Run after any change to data/answers.json or
// data/match_config.json:   npm run build
const { Matcher } = require('../lib/matcher');
const t = Date.now();
Matcher.build().then((r) => console.log('built matcher:', r, 'in', Math.round((Date.now() - t) / 1000), 's')).catch((e) => { console.error(e); process.exit(1); });
