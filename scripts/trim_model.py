#!/usr/bin/env python3
"""
Vocabulary trimming for multilingual-e5-small (quantized ONNX) -> "wira-e5-small-ascii".

Why: the full model + tokenizer needs ~460-560 MB RAM in Node (250,002-token vocabulary),
which does not fit the Render free plan (512 MB). Patients type English / Bahasa Malaysia
in the Latin alphabet, so we keep only vocabulary pieces made of printable ASCII
(plus the special tokens) and drop the matching rows of the embedding table.

Lossless for ASCII input: the Unigram tokenizer only ever uses pieces that are substrings
of the (normalised) input, so for ASCII text the best segmentation is made of ASCII pieces,
all of which are kept. Token sequence and therefore the embedding vector are identical
to the original model. The app converts smart quotes / accents to ASCII before matching.

Usage:  python3 scripts/trim_model.py <source_dir> <output_dir>
  source_dir must contain: config.json tokenizer.json tokenizer_config.json
                           special_tokens_map.json onnx/model_quantized.onnx
  (Official source: https://huggingface.co/Xenova/multilingual-e5-small)
Requires: pip install onnx numpy
"""
import hashlib, json, os, shutil, sys
import numpy as np
import onnx
from onnx import numpy_helper

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(dst, 'onnx'), exist_ok=True)

def sha(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()

tj = json.load(open(os.path.join(src, 'tokenizer.json'), encoding='utf-8'))
vocab = tj['model']['vocab']
assert tj['model']['type'] == 'Unigram'

def ascii_piece(p):
    return all(32 <= ord(c) < 127 for c in p.replace('▁', ''))

special_ids = {a['id'] for a in tj['added_tokens']}
keep = [i for i, (p, _s) in enumerate(vocab) if ascii_piece(p) or i in special_ids]
old2new = {o: n for n, o in enumerate(keep)}

tj['model']['vocab'] = [vocab[i] for i in keep]
tj['model']['unk_id'] = old2new[tj['model']['unk_id']]
for a in tj['added_tokens']:
    a['id'] = old2new[a['id']]
pp = tj.get('post_processor') or {}
for tok in (pp.get('special_tokens') or {}).values():
    tok['ids'] = [old2new[i] for i in tok['ids']]
json.dump(tj, open(os.path.join(dst, 'tokenizer.json'), 'w', encoding='utf-8'), ensure_ascii=False)

cfg = json.load(open(os.path.join(src, 'config.json')))
cfg['vocab_size'] = len(keep)
cfg['_wira_note'] = 'Vocabulary trimmed to printable-ASCII pieces by scripts/trim_model.py'
json.dump(cfg, open(os.path.join(dst, 'config.json'), 'w'), indent=2)
for f in ('tokenizer_config.json', 'special_tokens_map.json'):
    shutil.copy(os.path.join(src, f), os.path.join(dst, f))

src_model = os.path.join(src, 'onnx', 'model_quantized.onnx')
m = onnx.load(src_model)
name = 'embeddings.word_embeddings.weight_quantized'
for idx, init in enumerate(m.graph.initializer):
    if init.name == name:
        w = numpy_helper.to_array(init)
        new = numpy_helper.from_array(np.ascontiguousarray(w[keep]), name)
        m.graph.initializer[idx].CopyFrom(new)
        print('embedding', w.shape, '->', new.dims)
        break
else:
    sys.exit('word embedding initializer not found')
# the scale / zero point of this tensor are per-tensor scalars, so row slicing is exact
dst_model = os.path.join(dst, 'onnx', 'model_quantized.onnx')
onnx.save(m, dst_model)

card = {
    'name': 'wira-e5-small-ascii',
    'upstream': 'intfloat/multilingual-e5-small (MIT licence); ONNX q8 export Xenova/multilingual-e5-small',
    'source_sha256': {'onnx/model_quantized.onnx': sha(src_model), 'tokenizer.json': sha(os.path.join(src, 'tokenizer.json'))},
    'output_sha256': {'onnx/model_quantized.onnx': sha(dst_model), 'tokenizer.json': sha(os.path.join(dst, 'tokenizer.json'))},
    'vocab_kept': len(keep), 'vocab_original': len(vocab),
}
json.dump(card, open(os.path.join(dst, 'MODEL_CARD.json'), 'w'), indent=2)
print(json.dumps(card, indent=2))
