(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     ALGORITHM WATCHDOG LAB — frontend
     - Loads /assets/data/watchdog/trending.json
     - Renders five sections:
       § I    lede paragraph (computed by the cron, dropped in)
       § II   duration histogram + 30-day median trend
       § III  posting heatmap (the centerpiece)
       § IV   category mix stacked bars
       § V    channel concentration table
       § VI   receipts
     All charts are hand-rolled SVG.
     ═══════════════════════════════════════════════════════════ */

  // Editorial palette: 12 categories max, restrained warm/cool tones
  const CAT_COLORS = {
    'Music':              '#7e3a3a',
    'Gaming':             '#5d4d7a',
    'Entertainment':      '#947b5b',
    'Sports':             '#5a7a8c',
    'Comedy':             '#a78b6a',
    'News & Politics':    '#3b4a59',
    'Howto & Style':      '#7a6e3d',
    'People & Blogs':     '#7c5a8c',
    'Film & Animation':   '#ad6c52',
    'Education':          '#3d6a7d',
    'Science & Tech':     '#5a6b54',
    'Autos & Vehicles':   '#8c6447',
    'Pets & Animals':     '#6e8a4a',
    'Travel & Events':    '#3a6a4d',
    'Nonprofits':         '#5a8a8a',
    'Shows':              '#8a4a4a',
    'Movies':             '#6a4a8a',
    'Short Movies':       '#4a4a8a',
    'Videoblogging':      '#8a8474',
  };
  const FALLBACK_COLOR = '#8a8474';

  let DATA = null;

  // ── DOM refs ───────────────────────────────────────────────
  const $lede        = document.getElementById('aw-lede');
  const $lastRefresh = document.getElementById('aw-last-refresh');
  const $hist        = document.getElementById('aw-hist');
  const $trend       = document.getElementById('aw-trend');
  const $heat        = document.getElementById('aw-heatmap');
  const $heatLeg     = document.getElementById('aw-heatmap-legend');
  const $stack       = document.getElementById('aw-stack');
  const $stackLeg    = document.getElementById('aw-stack-legend');
  const $channels    = document.getElementById('aw-channels-body');
  const $receipts    = document.getElementById('aw-receipts');

  // ── Utilities ──────────────────────────────────────────────
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, ch =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  function fmtMin(s) {
    if (s == null) return '—';
    const m = Math.floor(s / 60), sec = Math.round(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  }
  function fmtNum(n) {
    if (n == null) return '—';
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }

  // ── Bootstrap ──────────────────────────────────────────────
  fetch('/assets/data/watchdog/trending.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : Promise.reject(new Error('trending.json missing')))
    .then(d => {
      DATA = d;
      renderLede();
      renderHistogram();
      renderTrend();
      renderHeatmap();
      renderStack();
      renderChannels();
      renderReceipts();
    })
    .catch(err => {
      if ($lede) $lede.textContent = 'Data not yet available. The cron has not run yet — check back in a day.';
      console.error('watchdog-lab:', err);
    });

  // ── § I  Lede ──────────────────────────────────────────────
  function renderLede() {
    if (!$lede) return;
    $lede.textContent = DATA.lede || '—';
    if ($lastRefresh && DATA.last_refresh) {
      const d = new Date(DATA.last_refresh);
      $lastRefresh.textContent = d.toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC';
    }
  }

  // ── Last 7 days of videos helper ───────────────────────────
  function last7Videos() {
    if (!DATA?.days?.length) return [];
    const lastDate = DATA.days[DATA.days.length - 1].date;
    const cutoff = new Date(lastDate);
    cutoff.setUTCDate(cutoff.getUTCDate() - 6);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const out = [];
    for (const d of DATA.days) {
      if (d.date >= cutoffStr) out.push(...(d.videos || []));
    }
    return out;
  }

  // ── § II.a Histogram ───────────────────────────────────────
  function renderHistogram() {
    if (!$hist) return;
    const vids = last7Videos();
    const durs = vids.map(v => v.duration_seconds).filter(s => s > 0);
    if (!durs.length) { $hist.innerHTML = ''; return; }

    // Buckets: 0-60s, 60s-2m, 2-4m, 4-7m, 7-10m, 10-15m, 15-20m, 20-30m, 30-45m, 45m+
    const edges = [0, 60, 120, 240, 420, 600, 900, 1200, 1800, 2700, Infinity];
    const labels = ['<1m', '1–2m', '2–4m', '4–7m', '7–10m', '10–15m', '15–20m', '20–30m', '30–45m', '45m+'];
    const counts = new Array(labels.length).fill(0);
    for (const s of durs) {
      for (let i = 0; i < labels.length; i++) {
        if (s < edges[i + 1]) { counts[i]++; break; }
      }
    }
    const max = Math.max(...counts) || 1;
    const median = durs.slice().sort((a, b) => a - b)[Math.floor(durs.length / 2)];

    const w = 540, h = 280;
    const m = { l: 28, r: 16, t: 14, b: 36 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const bw = iw / labels.length;
    const yScale = c => m.t + ih - (c / max) * ih;

    let svg = '';
    [0, max * 0.5, max].forEach(t => {
      svg += `<line class="gridline" x1="${m.l}" x2="${m.l+iw}" y1="${yScale(t)}" y2="${yScale(t)}"/>`;
      svg += `<text class="axis" x="${m.l-4}" y="${yScale(t)+3}" text-anchor="end">${Math.round(t)}</text>`;
    });
    counts.forEach((c, i) => {
      const x = m.l + i * bw + 2;
      const y = yScale(c);
      const isMedian = (median >= edges[i] && median < edges[i+1]);
      svg += `<rect class="bar${isMedian ? ' median' : ''}" x="${x}" y="${y}" width="${bw - 4}" height="${m.t + ih - y}"><title>${labels[i]}: ${c} videos</title></rect>`;
      svg += `<text class="axis" x="${x + bw/2 - 2}" y="${m.t+ih+14}" text-anchor="middle">${labels[i]}</text>`;
    });
    // Median callout
    const medMin = Math.floor(median / 60), medSec = Math.round(median % 60);
    svg += `<text class="median-label" x="${m.l + iw - 4}" y="${m.t + 14}" text-anchor="end">MED ${medMin}:${String(medSec).padStart(2,'0')}</text>`;
    $hist.innerHTML = svg;
  }

  // ── § II.b Median trend ────────────────────────────────────
  function renderTrend() {
    if (!$trend) return;
    if (!DATA?.days?.length) return;
    const points = DATA.days.map(d => {
      const durs = (d.videos || []).map(v => v.duration_seconds).filter(s => s > 0).sort((a,b) => a - b);
      const med = durs.length ? durs[Math.floor(durs.length/2)] : null;
      return { date: d.date, med };
    }).filter(p => p.med != null);
    if (points.length < 2) { $trend.innerHTML = ''; return; }

    const w = 540, h = 280;
    const m = { l: 32, r: 16, t: 14, b: 36 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const meds = points.map(p => p.med);
    const yMin = Math.max(0, Math.min(...meds) - 60);
    const yMax = Math.max(...meds) + 60;
    const yScale = v => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
    const xScale = i => m.l + (i / (points.length - 1)) * iw;

    let svg = '';
    // Y gridlines at 4 levels
    for (let i = 0; i <= 4; i++) {
      const v = yMin + (yMax - yMin) * (i / 4);
      svg += `<line class="gridline" x1="${m.l}" x2="${m.l+iw}" y1="${yScale(v)}" y2="${yScale(v)}"/>`;
      svg += `<text class="axis" x="${m.l-4}" y="${yScale(v)+3}" text-anchor="end">${fmtMin(v)}</text>`;
    }
    // X axis: first / mid / last labels
    [0, Math.floor(points.length/2), points.length-1].forEach(i => {
      const d = new Date(points[i].date);
      const lbl = `${d.toLocaleString('en', { month: 'short' })} ${d.getUTCDate()}`;
      svg += `<text class="axis" x="${xScale(i)}" y="${m.t+ih+14}" text-anchor="middle">${lbl}</text>`;
    });
    // Polyline
    const pts = points.map((p, i) => `${xScale(i).toFixed(1)},${yScale(p.med).toFixed(1)}`).join(' ');
    svg += `<polyline class="data-line" points="${pts}"/>`;
    // Dots
    points.forEach((p, i) => {
      svg += `<circle cx="${xScale(i)}" cy="${yScale(p.med)}" r="2.5" fill="var(--ink)"><title>${p.date}: median ${fmtMin(p.med)}</title></circle>`;
    });
    $trend.innerHTML = svg;
  }

  // ── § III  Posting heatmap ─────────────────────────────────
  function renderHeatmap() {
    if (!$heat) return;
    const allVids = (DATA?.days || []).flatMap(d => d.videos || []);
    if (!allVids.length) return;

    // Bin by ET day-of-week × hour
    const bins = Array.from({ length: 7 }, () => new Array(24).fill(0));
    let maxCount = 0;
    for (const v of allVids) {
      if (!v.published_at) continue;
      const d = new Date(v.published_at);
      // UTC to ET (UTC-5, ignoring DST for v1)
      d.setUTCHours(d.getUTCHours() - 5);
      const dow = (d.getUTCDay() + 6) % 7; // Mon=0
      const hr = d.getUTCHours();
      bins[dow][hr]++;
      if (bins[dow][hr] > maxCount) maxCount = bins[dow][hr];
    }
    if (!maxCount) return;

    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const w = 720, h = 240;
    const m = { l: 38, r: 8, t: 24, b: 8 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const cw = iw / 24;
    const cellH = ih / 7;

    function color(t) {
      // Cream → warm orange → red ramp
      // t in [0,1]
      const stops = [
        [0.0, [241, 236, 225]],   // paper
        [0.3, [232, 196, 130]],
        [0.6, [220, 130, 80]],
        [1.0, [160, 50, 40]],
      ];
      let prev = stops[0], next = stops[stops.length - 1];
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) { prev = stops[i-1]; next = stops[i]; break; }
      }
      const span = next[0] - prev[0];
      const k = span > 0 ? (t - prev[0]) / span : 0;
      const r = Math.round(prev[1][0] + (next[1][0] - prev[1][0]) * k);
      const g = Math.round(prev[1][1] + (next[1][1] - prev[1][1]) * k);
      const b = Math.round(prev[1][2] + (next[1][2] - prev[1][2]) * k);
      return `rgb(${r},${g},${b})`;
    }

    let svg = '';
    // Hour labels (every 3 hours)
    for (let h = 0; h <= 24; h += 3) {
      const x = m.l + h * cw;
      const lbl = h === 0 ? '12a' : h === 12 ? '12p' : h === 24 ? '12a' : (h < 12 ? `${h}a` : `${h-12}p`);
      svg += `<text class="label" x="${x}" y="${m.t-8}" text-anchor="middle">${lbl}</text>`;
    }
    // Day labels + cells
    for (let dow = 0; dow < 7; dow++) {
      svg += `<text class="label" x="${m.l-6}" y="${m.t + dow * cellH + cellH/2 + 3}" text-anchor="end">${days[dow]}</text>`;
      for (let hr = 0; hr < 24; hr++) {
        const c = bins[dow][hr];
        const t = c / maxCount;
        const x = m.l + hr * cw;
        const y = m.t + dow * cellH;
        svg += `<rect class="cell" x="${x}" y="${y}" width="${cw}" height="${cellH}" fill="${color(t)}"><title>${days[dow]} ${hr}:00 — ${c} videos</title></rect>`;
      }
    }
    $heat.innerHTML = svg;

    // Legend
    if ($heatLeg) {
      const swatches = [];
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        swatches.push(`<span class="sw" style="background:${color(t)}"></span>`);
      }
      $heatLeg.innerHTML = `<span>Less</span><span class="swatches">${swatches.join('')}</span><span>More</span>`;
    }
  }

  // ── § IV  Stacked category bars ────────────────────────────
  function renderStack() {
    if (!$stack) return;
    const days = DATA?.days || [];
    if (!days.length) return;

    // Identify top N categories overall (rest collapse to "Other")
    const allCats = {};
    for (const d of days) for (const v of (d.videos || [])) {
      allCats[v.category] = (allCats[v.category] || 0) + 1;
    }
    const topCats = Object.entries(allCats).sort((a,b) => b[1] - a[1]).slice(0, 8).map(c => c[0]);
    const allShown = [...topCats, 'Other'];

    const w = 1080, h = 320;
    const m = { l: 32, r: 16, t: 14, b: 30 };
    const iw = w - m.l - m.r;
    const ih = h - m.t - m.b;
    const bw = iw / days.length;

    let svg = '';
    days.forEach((d, di) => {
      const counts = {};
      for (const v of (d.videos || [])) {
        const c = topCats.includes(v.category) ? v.category : 'Other';
        counts[c] = (counts[c] || 0) + 1;
      }
      const total = Object.values(counts).reduce((a,b) => a+b, 0) || 1;
      let cumY = m.t + ih;
      for (const cat of allShown) {
        const count = counts[cat] || 0;
        if (!count) continue;
        const segH = (count / total) * ih;
        const segY = cumY - segH;
        const color = cat === 'Other' ? FALLBACK_COLOR : (CAT_COLORS[cat] || FALLBACK_COLOR);
        svg += `<rect class="cat-rect" x="${m.l + di * bw}" y="${segY}" width="${bw - 1}" height="${segH}" fill="${color}"><title>${d.date} — ${cat}: ${count}</title></rect>`;
        cumY = segY;
      }
    });

    // X-axis labels: every 5 days
    days.forEach((d, di) => {
      if (di % 5 !== 0 && di !== days.length - 1) return;
      const dt = new Date(d.date);
      const lbl = `${dt.toLocaleString('en', { month: 'short' })} ${dt.getUTCDate()}`;
      svg += `<text class="axis" x="${m.l + di * bw + bw/2}" y="${m.t+ih+14}" text-anchor="middle">${lbl}</text>`;
    });
    $stack.innerHTML = svg;

    if ($stackLeg) {
      $stackLeg.innerHTML = allShown.map(cat => `
        <span class="item">
          <span class="sw" style="background:${cat === 'Other' ? FALLBACK_COLOR : (CAT_COLORS[cat] || FALLBACK_COLOR)}"></span>
          ${escapeHtml(cat)}
        </span>
      `).join('');
    }
  }

  // ── § V  Channel concentration table ───────────────────────
  function renderChannels() {
    if (!$channels) return;
    const days = DATA?.days || [];
    const channelStats = {};
    for (const d of days) {
      for (const v of (d.videos || [])) {
        const k = v.channel_name;
        if (!k) continue;
        if (!channelStats[k]) {
          channelStats[k] = { name: k, appearances: 0, totalViews: 0, ranks: [], cats: {} };
        }
        channelStats[k].appearances++;
        channelStats[k].totalViews += (v.view_count || 0);
        channelStats[k].ranks.push(v.rank || 50);
        channelStats[k].cats[v.category] = (channelStats[k].cats[v.category] || 0) + 1;
      }
    }
    const sorted = Object.values(channelStats)
      .sort((a, b) => b.appearances - a.appearances || b.totalViews - a.totalViews)
      .slice(0, 14);

    $channels.innerHTML = sorted.map(c => {
      const avgRank = (c.ranks.reduce((s, r) => s + r, 0) / c.ranks.length).toFixed(1);
      const topCat = Object.entries(c.cats).sort((a,b) => b[1] - a[1])[0]?.[0] || '—';
      return `
        <tr>
          <td class="channel">${escapeHtml(c.name)}</td>
          <td class="num">${c.appearances}</td>
          <td class="num">${fmtNum(c.totalViews)}</td>
          <td class="num">${avgRank}</td>
          <td>${escapeHtml(topCat)}</td>
        </tr>`;
    }).join('');
  }

  // ── § VI  Receipts ─────────────────────────────────────────
  function renderReceipts() {
    if (!$receipts) return;
    fetch('/assets/data/watchdog/methodology.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : {})
      .then(m => {
        const allVids = (DATA?.days || []).reduce((s, d) => s + (d.videos || []).length, 0);
        const uniqueChannels = new Set(
          (DATA?.days || []).flatMap(d => (d.videos || []).map(v => v.channel_name))
        ).size;
        const cells = [
          { label: 'Days tracked',     value: m.days_tracked ?? (DATA?.days?.length || 0) },
          { label: 'Videos in window', value: fmtNum(allVids) },
          { label: 'Unique channels',  value: uniqueChannels },
          { label: 'API quota / day',  value: m.api_quota_per_day ?? '10', unit: 'units' },
        ];
        $receipts.innerHTML = cells.map(c => `
          <div class="aw-receipt">
            <div class="aw-receipt-label">${escapeHtml(c.label)}</div>
            <div class="aw-receipt-value">${escapeHtml(c.value)}${c.unit ? `<span class="small">${escapeHtml(c.unit)}</span>` : ''}</div>
          </div>
        `).join('');
      })
      .catch(() => {});
  }
})();
