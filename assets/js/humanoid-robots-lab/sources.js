// ─────────────────────────────────────────────────────────────
// Humanoid Robots Lab — flat sources + methodology section
// ─────────────────────────────────────────────────────────────
import { escapeHtml, confidenceBadge } from './ui-helpers.js';
import { getAllSources } from './data.js';

export function renderSources(catalog, mountEl) {
  if (!mountEl) return;
  const sources = getAllSources(catalog).sort((a, b) => a.label.localeCompare(b.label));
  const updated = catalog._meta?.last_updated || 'recent';

  const items = sources.map(s => `
    <li class="hr-source-flat">
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
        ${escapeHtml(s.label)} ↗
      </a>
      ${confidenceBadge(s.type)}
    </li>
  `).join('');

  mountEl.innerHTML = `
    <h2 class="hr-section-title">Sources &amp; methodology</h2>
    <div class="hr-methodology">
      <p>
        Specs are taken from each company's official product or platform page
        when available. Some values are quoted from press appearances and
        marked <em>reported</em>. A few are conservative estimates from public
        material and marked <em>estimated</em>. Where a number isn't disclosed,
        the field is marked <em>not publicly confirmed</em> rather than guessed.
      </p>
      <p>
        Three-dimensional models are <strong>visual proxies</strong> built from
        primitives unless an entry is explicitly marked <em>verified model</em>.
        The proxies use distinctive shape and color cues to be recognizable
        without copying any company's logos, trade dress, or product imagery.
      </p>
      <p>
        This is an editorial / educational comparison page, not an official
        catalog or ranking. Last updated <strong>${escapeHtml(updated)}</strong>.
      </p>
    </div>
    <h3 class="hr-block-title">Citations</h3>
    <ul class="hr-source-flat-list">${items}</ul>
  `;
}
