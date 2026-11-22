'use strict';
// Sentence embedder: multilingual-e5-small (quantized ONNX, ~118 MB), run locally in-process.
// The model can only turn text into numbers; it cannot write sentences.
const path = require('path');

const MODEL_ID = 'wira-e5-small-ascii'; // trimmed copy of Xenova/multilingual-e5-small (see scripts/trim_model.py)
const MODEL_ROOT = path.join(__dirname, '..', 'models');

let extractorPromise = null;

async function load() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');
      env.localModelPath = MODEL_ROOT + path.sep;
      env.allowRemoteModels = false; // never call out to the internet at runtime
      env.allowLocalModels = true;
      return pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8',
        session_options: { intraOpNumThreads: 1, interOpNumThreads: 1, enableCpuMemArena: false, enableMemPattern: false },
      });
    })();
    extractorPromise.catch(() => { extractorPromise = null; });
  }
  return extractorPromise;
}

// e5 models expect a "query: " prefix; we use it on both sides (symmetric matching).
async function embed(texts) {
  const extractor = await load();
  const list = Array.isArray(texts) ? texts : [texts];
  const out = [];
  for (let i = 0; i < list.length; i += 16) {
    const batch = list.slice(i, i + 16).map((t) => 'query: ' + t);
    const tensor = await extractor(batch, { pooling: 'mean', normalize: true });
    const dim = tensor.dims[1];
    for (let j = 0; j < batch.length; j++) {
      out.push(Array.from(tensor.data.slice(j * dim, (j + 1) * dim)));
    }
    if (typeof tensor.dispose === 'function') tensor.dispose();
  }
  return out;
}

module.exports = { load, embed, MODEL_ID, MODEL_ROOT };
