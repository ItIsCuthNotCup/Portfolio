# The Productivity Paradox Predictions Archive

**TEST. 04** of the jakecuth.com test suite.

A scrubbable archive of 91 confident, dated, named predictions about when information technology and AI will show up in aggregate productivity statistics. Plotted by year said and year targeted, with the actual BLS productivity series underneath.

## URL

`/work/productivity-predictions-lab/`

## Data schema

Each prediction in `assets/data/productivity-predictions/predictions.json` carries:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable identifier (e.g. `solow-1987`) |
| `predictor` | string | Name |
| `predictor_type` | enum | academic, central-bank, government, consultancy, sell-side, tech-industry, journalist, think-tank |
| `institution` | string | Affiliation at time of statement |
| `category` | enum | general-it-paradox, ai-aggregate-tfp, ai-labor-productivity, ai-sector-specific, ai-gdp-level, wage-effects, agi-singularity |
| `stance` | enum | bullish, bearish, neutral |
| `year_said` | integer | Year the prediction was made |
| `year_targeted` | integer or null | Year the productivity boost was predicted to arrive |
| `quote` | string | Verbatim or close paraphrase |
| `context` | string | Source and occasion |
| `source_url` | string | Primary source URL |
| `metric_predicted` | enum | labor-productivity-growth, tfp-growth, mfp-growth, gdp-level, gdp-growth, solow-residual, sector-output, wage-growth, unemployment-rate, general-vague, ai-aggregate-tfp, ai-labor-productivity, ai-gdp-level, ai-sector-specific |
| `magnitude_predicted` | number or null | Basis points or percent where specific |
| `outcome` | enum | did-not-happen, did-not-happen-yet, fulfilled-with-delay, fulfilled-on-time, partially-fulfilled, pending, unclear, anchor-quote |
| `outcome_note` | string | Interpretive note |
| `verification_confidence` | enum | high, medium, low |
| `tags` | string[] | Era and topic tags |

## BLS data

`assets/data/productivity-predictions/bls-productivity.json` contains:

- **Labor productivity** (PRS85006152): nonfarm business sector, annual % change, 1985-2025
- **Total Factor Productivity** (MPU4900013): nonfarm business sector, annual, 1985-2023 (lags)

### Refresh cadence

Quarterly, after the BLS Productivity and Costs release (~40 days after quarter end).

### Pull instructions

```python
import requests

url = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
headers = {'Content-Type': 'application/json'}
payload = {
    'seriesid': ['PRS85006152', 'MPU4900013'],
    'startyear': '1985',
    'endyear': '2025',
    'registrationkey': 'YOUR_KEY'  # optional for < 500 calls/day
}
response = requests.post(url, json=payload, headers=headers)
data = response.json()
```

## Known gaps

- **US-centric**: European central bank predictions are underrepresented.
- **Pre-1987**: Only Drucker (1978) and Bell (1979) for historical depth.
- **Sector-specific**: Only a handful of sector-level predictions included.
- **Wage effects**: Only two entries address wage-productivity links.
- **Live updates**: Post-2022 predictions are mostly pending. Quarterly refresh needed as target years arrive.

## File structure

```
work/productivity-predictions-lab/
  index.html
  README.md

assets/css/productivity-predictions-lab.css
assets/js/productivity-predictions-lab.js

assets/data/productivity-predictions/
  predictions.json
  bls-productivity.json

notebooks/productivity-predictions-lab.ipynb
```

## Frontend features

- **Scrubbable scatter**: X = year said, Y = year targeted. Diagonal = present moment.
- **Productivity overlay**: Toggleable BLS labor productivity + TFP series underneath the scatter.
- **Filter pills**: By predictor type, category, zoom level.
- **Right but Late mode**: Switches Y-axis to delay years for fulfilled predictions.
- **Side panel**: Click any point for full quote, context, source, and outcome note.
- **Archive table**: Filterable, sortable, expandable rows.
- **Small multiples**: Six era panels showing prediction density across decades.

## Sister labs

- **The Productivity Mystery** (`/work/productivity-lab/`): The BLS data, decomposition, and hypotheses.
- **AGI Horizon** (`/work/agi-forecast-lab/`): The same horizon methodology applied to AGI predictions.
