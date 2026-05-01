/* ═══════════════════════════════════════════════════════════════════
   MODEL ATLAS — DECISION TREE
   A scoring function over a curated catalog of ML models.

   Q1 (task) is a hard filter — a regression won't be recommended for
   classification. Q2–Q5 contribute weighted scores. Top score is the
   recommendation; ranks 2–3 become the "honest alternatives."

   The catalog covers 13 models. Phase 1 ships the wizard plus
   destinations for 5 of them (logistic regression, linear regression,
   decision tree, random forest, K-means). Phase 2/3 destinations are
   stubbed in the catalog so the wizard still recommends them
   correctly when the user's path leads there.

   Exposed on window.ModelAtlas.{ MODELS, recommend, ANSWER_VALUES }
   for the wizard to consume. Pure data + functions, no DOM.
   ═══════════════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  // Allowed values per question — the wizard's options bind to these.
  const ANSWER_VALUES = {
    q1_task: ['classification', 'regression', 'clustering', 'anomaly'],
    q2_size: ['tiny', 'small', 'big', 'huge'],
    q3_interp: ['critical', 'helpful', 'dont-care'],
    q4_shape: ['numerical', 'categorical', 'text', 'image', 'time-series', 'mixed'],
    q5_priority: ['inference', 'accuracy', 'training', 'size'],
  };

  // ── Model catalog ──────────────────────────────────────────────────
  // Each entry declares which TASKS it handles, sweet-spot DATA SIZES,
  // INTERPRETABILITY, DATA SHAPES it does well on, and what the model
  // OPTIMIZES for (to score against the user's priority answer).
  const MODELS = {
    'logistic-regression': {
      slug: 'logistic-regression',
      name: 'Logistic Regression',
      kicker: 'A line that learns from gradient.',
      task: ['classification'],
      size: ['tiny', 'small', 'big', 'huge'],
      interp: 'high',
      shape: ['numerical', 'mixed'],
      priority: ['inference', 'training', 'size'],
      summary:
        'Calibrated probability per class via a sigmoid over a linear combination of inputs. Cheap, interpretable, and ' +
        'still production-grade when features are mostly numeric and roughly linear.',
      live: true,                       // shipped destination
    },
    'linear-regression': {
      slug: 'linear-regression',
      name: 'Linear Regression',
      kicker: 'The line of best fit, with receipts.',
      task: ['regression'],
      size: ['tiny', 'small', 'big', 'huge'],
      interp: 'high',
      shape: ['numerical'],
      priority: ['inference', 'training', 'size'],
      summary:
        'Closed-form least squares — every output is a weighted sum of inputs plus a bias. The ' +
        'baseline every other regressor is measured against, and often the right answer.',
      live: true,
    },
    'decision-tree': {
      slug: 'decision-tree',
      name: 'Decision Tree',
      kicker: 'A flowchart that fits the data.',
      task: ['classification', 'regression'],
      size: ['tiny', 'small'],
      interp: 'high',
      shape: ['mixed', 'categorical', 'numerical'],
      priority: ['inference', 'training'],
      summary:
        'Recursive binary splits on the feature that best separates the target. Reads like a flowchart, ' +
        'handles mixed data without preprocessing, but overfits without depth limits.',
      live: true,
    },
    'random-forest': {
      slug: 'random-forest',
      name: 'Random Forest',
      kicker: 'A committee of decision trees.',
      task: ['classification', 'regression'],
      size: ['small', 'big'],
      interp: 'medium',
      shape: ['mixed', 'numerical', 'categorical'],
      priority: ['accuracy'],
      summary:
        'Hundreds of decision trees trained on bootstrapped samples and random feature subsets, ' +
        'averaged into a single prediction. Famously hard to beat on tabular data.',
      live: true,
    },
    'kmeans': {
      slug: 'kmeans',
      name: 'K-Means',
      kicker: 'Lloyd\'s algorithm, drawn live.',
      task: ['clustering'],
      size: ['small', 'big', 'huge'],
      interp: 'medium',
      shape: ['numerical'],
      priority: ['inference', 'training', 'size'],
      summary:
        'Partition n points into k clusters by alternating: assign each point to the nearest centroid, ' +
        'recompute centroids as the mean of their members. Fast, simple, sensitive to k.',
      live: true,
    },
    'knn': {
      slug: 'knn',
      name: 'K-Nearest Neighbors',
      kicker: 'No training. Just memory.',
      task: ['classification', 'regression'],
      size: ['tiny', 'small'],
      interp: 'medium',
      shape: ['numerical'],
      priority: ['training', 'accuracy'],
      summary:
        'No model. Predict by finding the k closest training points and voting (or averaging). ' +
        'Trivially simple, but every prediction scans the dataset.',
      live: true,
    },
    'svm': {
      slug: 'svm',
      name: 'Support Vector Machine',
      kicker: 'The widest margin wins.',
      task: ['classification', 'regression'],
      size: ['tiny', 'small'],
      interp: 'medium',
      shape: ['numerical'],
      priority: ['accuracy'],
      summary:
        'Find the hyperplane with the largest margin between classes, optionally lifted into a higher-dimensional ' +
        'space via a kernel. Strong on small high-dimensional datasets.',
      live: true,
    },
    'gradient-boosting': {
      slug: 'gradient-boosting',
      name: 'Gradient Boosting (XGBoost)',
      kicker: 'Trees, but each one fixes the last.',
      task: ['classification', 'regression'],
      size: ['small', 'big', 'huge'],
      interp: 'medium',
      shape: ['mixed', 'numerical', 'categorical'],
      priority: ['accuracy'],
      summary:
        'Sequentially adds decision trees, each one fitted to the residuals of the previous. ' +
        'XGBoost / LightGBM dominate Kaggle leaderboards for a reason.',
      live: true,
    },
    'naive-bayes': {
      slug: 'naive-bayes',
      name: 'Naive Bayes',
      kicker: 'Bayes\' theorem, applied bluntly.',
      task: ['classification'],
      size: ['tiny', 'small', 'big'],
      interp: 'high',
      shape: ['text', 'categorical'],
      priority: ['training', 'inference', 'size'],
      summary:
        'Apply Bayes\' theorem under the assumption that features are conditionally independent. ' +
        'Wrong assumption, surprisingly useful answer — especially on text.',
      live: true,
    },
    'ridge-lasso': {
      slug: 'ridge-lasso',
      name: 'Ridge / Lasso',
      kicker: 'Linear, but disciplined.',
      task: ['regression', 'classification'],
      size: ['tiny', 'small', 'big', 'huge'],
      interp: 'high',
      shape: ['numerical'],
      priority: ['inference', 'training', 'size'],
      summary:
        'Linear models with an L2 (ridge) or L1 (lasso) penalty on the coefficients. Lasso ' +
        'zeroes out unhelpful features automatically — feature selection as a side effect.',
      live: true,
    },
    'mlp': {
      slug: 'mlp',
      name: 'Neural Network (MLP)',
      kicker: 'Layers of nonlinearity.',
      task: ['classification', 'regression'],
      size: ['big', 'huge'],
      interp: 'low',
      shape: ['numerical', 'image', 'text', 'mixed'],
      priority: ['accuracy'],
      summary:
        'Stacked layers of linear transforms with nonlinear activations. Universal function ' +
        'approximators in theory; in practice, hungry for data and tuning.',
      live: true,
    },
    'dbscan': {
      slug: 'dbscan',
      name: 'DBSCAN',
      kicker: 'Clusters without committing to k.',
      task: ['clustering', 'anomaly'],
      size: ['small', 'big'],
      interp: 'medium',
      shape: ['numerical'],
      priority: ['accuracy'],
      summary:
        'Density-based clustering: points in dense neighborhoods are clusters, sparse points are noise. ' +
        'No need to pick k — but two parameters (eps, minPts) replace it.',
      live: true,
    },
    'isolation-forest': {
      slug: 'isolation-forest',
      name: 'Isolation Forest',
      kicker: 'Outliers are easy to isolate.',
      task: ['anomaly'],
      size: ['small', 'big', 'huge'],
      interp: 'medium',
      shape: ['numerical', 'mixed'],
      priority: ['inference', 'training'],
      summary:
        'Randomly split features until every point is isolated. Anomalies require fewer splits — ' +
        'so the average path-length in a forest of random trees becomes an anomaly score.',
      live: true,
    },
  };

  // ── Scoring helpers ────────────────────────────────────────────────

  // Hard filter — model must declare it handles this task.
  function matchesTask(model, task) {
    return Array.isArray(model.task) && model.task.indexOf(task) !== -1;
  }

  // Size: 30 if model lists this size as a sweet spot, 0 otherwise.
  function sizeFit(model, size) {
    return model.size.indexOf(size) !== -1 ? 30 : 0;
  }

  // Interpretability: critical → high (40), medium (10), low (-30); helpful → high (15), medium (15), low (0); dont-care → 0.
  function interpFit(model, want) {
    const tier = model.interp; // 'high' | 'medium' | 'low'
    if (want === 'critical') {
      return tier === 'high' ? 40 : tier === 'medium' ? 10 : -30;
    }
    if (want === 'helpful') {
      return tier === 'high' ? 15 : tier === 'medium' ? 15 : 0;
    }
    // 'dont-care' — interpretability is not a factor.
    return 0;
  }

  // Shape: 25 if model declares this shape; partial credit (10) for 'mixed' on
  // any shape since mixed data usually overlaps with numerical/categorical.
  function shapeFit(model, shape) {
    if (model.shape.indexOf(shape) !== -1) return 25;
    if (shape === 'mixed' && (model.shape.indexOf('numerical') !== -1 || model.shape.indexOf('categorical') !== -1)) {
      return 10;
    }
    return 0;
  }

  // Priority: 25 if the model's optimization list includes the user's priority.
  function priorityFit(model, want) {
    return model.priority.indexOf(want) !== -1 ? 25 : 0;
  }

  // ── Public: scoreModel + recommend ─────────────────────────────────

  function scoreModel(model, answers) {
    if (!matchesTask(model, answers.q1_task)) return null;       // hard filter
    let total = 100;                                             // base for passing the hard filter
    total += sizeFit(model, answers.q2_size);
    total += interpFit(model, answers.q3_interp);
    total += shapeFit(model, answers.q4_shape);
    total += priorityFit(model, answers.q5_priority);
    return total;
  }

  // Returns ranked list: [{ slug, name, kicker, summary, score, live }, ...]
  // Top entry is the recommendation. Entries 2+ are honest alternatives.
  function recommend(answers) {
    const ranked = [];
    Object.values(MODELS).forEach(function (model) {
      const score = scoreModel(model, answers);
      if (score === null) return;
      ranked.push({
        slug: model.slug,
        name: model.name,
        kicker: model.kicker,
        summary: model.summary,
        score: score,
        live: model.live,
      });
    });
    ranked.sort(function (a, b) { return b.score - a.score; });
    return ranked;
  }

  // ── Reasons — produce per-model "why this scored well" notes ───────
  // Used to render the recommendation panel ("Recommended because…").
  function reasonsFor(slug, answers) {
    const model = MODELS[slug];
    if (!model) return [];
    const reasons = [];
    if (model.size.indexOf(answers.q2_size) !== -1) {
      reasons.push('Performs in your data-size range (' + answers.q2_size + ').');
    }
    if (answers.q3_interp === 'critical' && model.interp === 'high') {
      reasons.push('Highly interpretable — coefficients or rules are auditable directly.');
    }
    if (answers.q3_interp === 'critical' && model.interp === 'low') {
      reasons.push('Caveat: interpretability is low. Pair with SHAP or LIME for audits.');
    }
    if (model.shape.indexOf(answers.q4_shape) !== -1) {
      reasons.push('Handles ' + answers.q4_shape + ' data without heavy preprocessing.');
    }
    if (model.priority.indexOf(answers.q5_priority) !== -1) {
      reasons.push('Optimizes for your stated priority (' + answers.q5_priority + ').');
    }
    return reasons;
  }

  // ── Export ─────────────────────────────────────────────────────────
  global.ModelAtlas = {
    MODELS: MODELS,
    ANSWER_VALUES: ANSWER_VALUES,
    scoreModel: scoreModel,
    recommend: recommend,
    reasonsFor: reasonsFor,
  };
})(window);
