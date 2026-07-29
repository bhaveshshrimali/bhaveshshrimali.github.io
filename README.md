# Bhavesh Shrimali — research portfolio

Dependency-free personal research site for GitHub Pages. The deployed page is plain semantic HTML, CSS, and first-party JavaScript; it has no package manager, runtime build step, cookies, local storage, API, database, or backend.

## Local preview

From this directory, run:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. The publication filters, section-aware navigation, and scientific background work locally. Analytics is always disabled on `localhost`, `127.0.0.1`, IPv6 localhost, and `file:` URLs.

## Analytics configuration

The site supports optional [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/). It is disabled by default:

```html
<meta name="cf-web-analytics-token" content="">
```

After local approval, paste the public site token into `content`. The first-party loader in `site.js` then loads Cloudflare's beacon only on a non-local hostname. The intended dashboard dimensions are aggregate page views, countries, referrer hosts, device types, and browsers. No custom interaction events are collected by this site.

### Public visitor dashboard

The country dashboard never calls Cloudflare from the browser. It polls the small,
same-origin `data/visitor-stats.json` snapshot once a minute and redraws its native
canvas chart without a charting dependency. The snapshot is refreshed hourly by
`.github/workflows/update-visitor-stats.yml`, which runs
`scripts/update-visitor-stats.mjs` with three repository secrets:

- `CF_API_TOKEN`: a scoped token with **Account → Account Analytics → Read** only
- `CF_ACCOUNT_TAG`: the Cloudflare account ID
- `CF_SITE_TAG`: the Web Analytics site tag (the same public identifier placed in the meta field)

Until all three secrets are present, the workflow leaves the checked-in,
unconfigured snapshot unchanged. The API token is never written to the repository
or sent to visitors. Public data is limited to a rolling 30-day visit total and
country groups; any country with fewer than three visits is merged into `Other`.
Cloudflare's `visits` metric is aggregate traffic, not an attempt to identify unique
people. The page shows the last successful update and continues serving that
snapshot if a later API request fails.

## Security model

- A restrictive meta Content Security Policy allows first-party assets and the optional Cloudflare beacon only.
- Third-party fonts, MathJax, polyfills, inline scripts, and inline event handlers are intentionally absent.
- All external links use HTTPS; links opening a new tab include `rel="noopener noreferrer"`.
- GitHub Pages supplies HTTPS and HSTS, but it does not provide repository-level control over arbitrary response headers. Response-only policies such as `Permissions-Policy`, `X-Content-Type-Options`, and CSP `frame-ancestors` require a custom domain in front of a configurable proxy/CDN.

## Blackboard equations

The blackboard uses real LaTeX rendered at development time into transparent,
first-party PNG assets. Edit `images/equations/background-equations.tex`, then
regenerate the images with a local TeX Live and Ghostscript installation:

```sh
mkdir -p /tmp/bhavesh-equations-build
pdflatex -interaction=nonstopmode -halt-on-error \
  -output-directory=/tmp/bhavesh-equations-build \
  images/equations/background-equations.tex
gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=pngalpha -r300 \
  -dTextAlphaBits=4 -dGraphicsAlphaBits=4 \
  -sOutputFile=images/equations/equation-%02d.png \
  /tmp/bhavesh-equations-build/background-equations.pdf
```

The browser loads only the small rendered images. It does not load MathJax,
KaTeX, TeX, or external math fonts.

## Solver-generated FEM backgrounds

The three ambient FEM animations in `images/fem/` were generated locally with
FElupe 10.1.0, NumPy, Matplotlib, and Pillow from the existing `fem` Conda
environment. The quarter-circle animation uses a mixed displacement-pressure-volume
formulation with rigid-plate contact. The three-dimensional animation uses a
compressible Neo-Hookean square-section rod, clamped at one end and shortened while
the other end twists through 270 degrees on a refined hexahedral mesh.

The quarter-wafer animation is reconstructed from the saved radial displacement
history in the local `waferbonding_project` paper run. It shows the computed wafer
surface evolving from its initial flat state to the final bonded deformation.

The generation scripts, timestamped solution states, and individual rendered frames
are intentionally kept outside this repository. Only the optimized GIFs and their
maximum-deformation WebP posters are deployed. The site selects posters instead of
animated files when the visitor requests reduced motion or the page is hidden.

## Validation

Useful local checks (use an HTML5-aware validator rather than the legacy macOS
`tidy`, which predates semantic elements such as `main` and `article`):

```sh
node --check site.js                       # when Node.js is available
rg -o 'id="[^"]+"' index.html | sort | uniq -d
rg -n 'http://|onmouse|onclick|innerHTML|eval\(' index.html stylesheet.css site.js
git diff --check
```

The local review was also exercised in Chromium at desktop and narrow widths
and audited with Lighthouse while analytics was disabled.

The attached source paper `../bonding.pdf` is intentionally not copied into this repository; the publication entry links to its canonical arXiv record and PDF.
