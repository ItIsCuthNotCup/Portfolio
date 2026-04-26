# ML pipeline — for labs that ship a trained model

Read this only if the lab needs a trained model. Pure-JS labs can
skip the entire file.

## Environment constraints

The Cowork sandbox does NOT have PyTorch and probably can't install
it (out of disk space). The default training stack is:

- `numpy`
- `scikit-learn` (MLPClassifier, RandomForest, etc.)
- `skl2onnx` for export
- `onnxruntime` (Python) for round-trip verification

A real CNN needs PyTorch which means the user runs the notebook on
their own Mac or on Colab. For sandbox-runnable labs, stick to MLP
or tree-based models.

## Notebook contract

The training script lives at `notebooks/<slug>_model.py`. It must:

1. Be runnable end-to-end with `python3 notebooks/<slug>_model.py`
   from the repo root.
2. Cache raw data in `.cache/<slug>/` (gitignored — see root
   `.gitignore`).
3. Produce these output files at exact paths:
   - `assets/models/<slug>/model.onnx`
   - `assets/models/<slug>/categories.json` (or whatever label
     index file the frontend needs)
   - `assets/data/<slug>/methodology.json` for the receipts panel
4. Verify the ONNX round-trip: predictions from the exported model
   must match sklearn predictions to within 1e-3 on a held-out
   sample. Abort training if this fails.
5. Print a clear summary at the end: model size, top-1 / top-3
   accuracy (for classifiers), training time, output paths.

Use `templates/notebook.py` as the starting point; it implements
all of this.

## ONNX export contract (the part that matters most)

skl2onnx with `options={id(clf): {'zipmap': False}}` produces an
ONNX model with two outputs:

- `label` — int64 tensor of shape `[None]` with predicted class indices
- `probabilities` — float32 tensor of shape `[None, n_classes]` with
  per-class probabilities

The frontend JS should select `result.probabilities` and ignore
`result.label`. Use this exact pattern (it tolerates output-name
variants from different exporters):

```js
const probsTensor = result.probabilities || result.output_probability ||
  Object.values(result).find((t) =>
    t.dims && t.dims.length >= 1 &&
    t.dims[t.dims.length - 1] === state.categories.length
  );
```

For PyTorch-trained models exported via `torch.onnx.export`, the
output is typically a single `output` tensor. Use the fallback
`Object.values(result).find(...)` branch.

## methodology.json schema

The receipts panel reads this JSON to populate its grid. Required
fields (all may be `null` if not applicable):

```json
{
  "model": "string — e.g. 'MLP (256-128-30) ReLU, sklearn 1.7.2'",
  "training_samples": 90000,
  "test_samples": 15000,
  "categories": 30,
  "params": 235000,
  "top1_accuracy": 0.786,
  "top3_accuracy": 0.903,
  "model_size_kb": 930,
  "training_time_seconds": null,
  "worst_confusions": [
    { "true": "donut", "predicted": "smiley face", "count": 40, "rate": 0.08 },
    ...
  ],
  "per_class_accuracy": {
    "category_name": 0.78,
    ...
  }
}
```

Optional fields the frontend may use:
- `dataset_url`, `notebook_url`, `paper_url`

## Browser preprocessing parity

This is the rule that has bit every ML lab. **The browser must
preprocess inputs the EXACT same way training data was preprocessed.**
Mismatches collapse the model to its prior — predictions look fine
on synthetic test data but fail on real user input.

Specifically:

- **Same image dimensions.** If trained on 28×28, send 28×28. If
  trained on 224×224, send 224×224.
- **Same color order.** If trained on grayscale, send grayscale.
  If trained on BGR (OpenCV default), send BGR.
- **Same value range.** If trained on `[0, 1]` floats, normalize.
  If trained on `[-1, 1]`, shift and scale. If trained on uint8
  raw, send uint8.
- **Same orientation / flips / crops.** If training data was
  centered and tightly cropped, do the same in the browser.
- **Same binarization or smoothing.** If training data is binary,
  threshold at the same value.

### Verification ritual (do this every time)

Before declaring an ML lab working, run this check:

1. Synthesize 3-4 trivial inputs in Python (e.g., a centered
   horizontal line, a centered circle, an empty input).
2. Run them through the deployed `model.onnx` via Python
   `onnxruntime`.
3. Make sure the predictions are sane:
   - "Centered circle" → top-3 includes things shaped like circles
   - "Empty input" → tells you the model's prior (note this; the
     frontend should refuse to predict on near-empty input)
4. Now write the browser preprocessing in JS. Replicate the same
   steps as the Python pipeline.
5. Use a small test page (or just devtools console) to send a
   synthetic input through the JS pipeline and confirm the
   predictions match the Python pipeline within a few percent.

The sketch lab failed this check the first time. We sent
uncentered, soft-grayscale input to a model trained on centered,
binary input. The fix was bbox-cropping + binarization in JS.

## Model size budget

The model loads at page time. Keep it under 1.5 MB ONNX or the
page-weight target slips. If the model is bigger, either:

- Quantize to int8 (`onnxruntime.quantization.quantize_dynamic`)
- Drop low-accuracy classes from the trained set
- Switch to a smaller architecture

## Inference latency target

Under 50 ms per call on a 5-year-old laptop. ONNX Runtime Web with
WASM single-threaded usually hits this for models under 1 MB.

For larger models or strict latency, enable WASM SIMD:

```js
ort.env.wasm.simd = true;
```

WebGPU is faster but flaky across browsers; not worth the support
matrix for portfolio traffic. Stick to WASM.

## Empty / near-empty input handling

The model has SOME prior on every input, including all-zeros. That
prior is whatever the most-frequent class was in training. For
sketch, the prior is "sun / lightning / mountain". Showing this
prediction to a user who hasn't drawn anything looks broken.

The frontend MUST refuse to predict when the input is essentially
empty. Pattern:

```js
function canvasToInputTensor() {
  // ...compute ink pixel count...
  if (inkPixels < MIN_INK_THRESHOLD) {
    return null;  // signal "not enough signal yet"
  }
  // ...build tensor...
}

async function predictNow() {
  const tensor = canvasToInputTensor();
  if (!tensor) {
    clearPredictions();
    return;
  }
  // ...run inference...
}
```
