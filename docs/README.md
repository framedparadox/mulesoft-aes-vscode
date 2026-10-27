# MuleSoft AES website

The marketing and documentation site for the **MuleSoft AES & Secure Properties** VS Code extension.
Plain static HTML, CSS and JavaScript with no build step, no dependencies and no third‑party requests.

## Pages

| File             | Purpose                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| `index.html`     | Product overview: hero, features, live demo, algorithm explorer, install, FAQ |
| `docs.html`      | Full documentation with a scroll‑synced table of contents               |
| `changelog.html` | Release notes (mirrors `../CHANGELOG.md`)                               |
| `privacy.html`   | Privacy policy for the extension and the site                           |
| `404.html`       | Not‑found page (GitHub Pages picks it up automatically)                  |

Supporting files: `assets/css/site.css` (all styles), `assets/js/site.js` (theme, nav, reveals, copy
buttons, scroll spy), `assets/js/home.js` (home‑page interactions), `assets/img/` (extension icons and
the 1200×630 `og-image.png`), `site.webmanifest`, `robots.txt`, `sitemap.xml`.

## Preview locally

```bash
python3 -m http.server 4173 --directory docs
```

Then open <http://localhost:4173>. Serve over HTTP rather than opening the file directly: the live demo
uses the Web Crypto API, which browsers only expose on `https://` and `localhost`.

## Appearance

Colours are defined once in `site.css` with CSS `light-dark()`, so the site follows the OS setting by
default. The moon/sun button in the nav and the Auto / Light / Dark control in the footer store an
explicit choice in `localStorage` (`mule-aes-theme`). The privacy section is intentionally dark in both
modes.

## Deploying

The site assumes it will be served from **`https://framedparadox.github.io/mulesoft-aes-vscode/`**.
That URL appears in the canonical and Open Graph tags of each page, in `robots.txt`, in `sitemap.xml`,
and as the `<base>` fallback in `404.html`. If you deploy somewhere else (a custom domain, Netlify,
Cloudflare Pages), search and replace it.

GitHub Pages can only publish from the repository root or `/docs` on a branch, so to publish this
folder use a Pages workflow that uploads `docs/` as the artifact (`actions/upload-pages-artifact`
with `path: docs`, then `actions/deploy-pages`), and set **Settings › Pages › Source** to
*GitHub Actions*.

`docs/**` is listed in `../.vscodeignore`, so none of this ships inside the VSIX.

## Keeping it current

When you release a new version, update:

- the version in `index.html` (hero meta line, JSON‑LD `softwareVersion`) and `docs.html` (hero intro),
- `changelog.html` with a new `<article class="release">` (move the **Latest** badge),
- `lastmod` dates in `sitemap.xml`.

## Live demo accuracy

`home.js` reimplements `src/aes/aesCrypto.ts` on the Web Crypto API: AES‑CBC with PKCS5/7 padding,
AES‑256 when the key is exactly 32 bytes and AES‑128 (first 16 bytes) otherwise, and the IV taken from
the first 16 characters of the key. With the sample key `DEV-7fQ2xK9mLp4Rv8Ns3Wb6Tz1Hc5Yj`,
`myDatabasePassword` encrypts to `![IC/nBJeEeAJg7vYzxVCcYJ+3DJZpthwL114HH38lEhM=]` in both the
extension and the browser. The hero animation and the whole‑file demo use ciphertexts precomputed
with the same key.
