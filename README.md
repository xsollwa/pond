# Pond

Pond is a browser extension that connects civic reading to local participation resources. Open a news article about housing, food insecurity, transit or another civic issue, click Pond, and it explains the issue and suggests ways to get involved near you.

It works in **Chrome, Edge and Firefox**. No account, server or API key is needed: the extension talks to Pond’s hosted service, which uses Claude to understand the page.

## Install

1. Go to the [latest release](https://github.com/xsollwa/pond/releases/latest) and download the zip for your browser: `pond-chrome-…zip`, `pond-edge-…zip` or `pond-firefox-…zip`.
2. Unzip it. You get a folder containing `manifest.json`.
3. Load it:
   - **Chrome:** open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and choose the unzipped folder.
   - **Edge:** open `edge://extensions`, turn on **Developer mode** (left side), click **Load unpacked** and choose the unzipped folder.
   - **Firefox:** open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…** and choose the `manifest.json` file inside the unzipped folder. Firefox removes temporary add-ons when it restarts, so repeat this step after restarting Firefox.
4. Keep the folder where it is. Chrome and Edge load the extension from that folder, so deleting or moving it removes Pond.

## Get started

Pond opens its Settings page after installation. (You can reopen it later from the extension’s options.)

1. **Website access:** click **Enable on supported websites**, or allow one website at a time. Pond only reads the sites you allow.
2. **Your area:** enter a city, state and country code, such as Princeton / NJ / US. Local suggestions currently cover Princeton, New Jersey and US-wide resources.
3. **Issue recognition:** turn on **Enable issue recognition on allowed websites** and click **Save settings**.
4. Open an article and click the Pond toolbar icon (pin it from the puzzle-piece menu so it’s easy to find). In Chrome and Edge you can also open Pond beside the page in a side panel.

## Good to know

- **Privacy:** when issue recognition is on, Pond sends a short text extract of the page (up to 16,000 characters), selected metadata and the site’s domain to Pond’s service and Anthropic. It never sends the full URL, HTML, form fields or your location. See [data and privacy](docs/data-and-privacy.md).
- **Daily limits:** the free shared service allows 40 analyses per person per day and 200 in total per day. If Pond says it’s at capacity, try again tomorrow.
- **Resources are examples:** suggested opportunities are sample resources, not verified event listings.
- **Pages Pond can’t read:** browser settings pages, extension stores and other restricted pages are unavailable.
- **Not in the web stores:** Pond is distributed as an unpacked extension from GitHub. It isn’t in the Chrome Web Store, Edge Add-ons or Firefox Add-ons.

## How it works

The extension extracts the main content of the page and sends it to a small service on Cloudflare Workers (`worker/`, `src/server/edge.ts`). The service validates the request, applies rate limits and daily quotas, asks Claude to classify the civic issue with cited evidence, validates the answer and returns it. The extension then matches the issue and your area against bundled local resources. See [architecture](docs/architecture.md) and [deployment](docs/deployment.md).

## Development and verification

Node 24 and pnpm 11.19.0:

```sh
pnpm install --frozen-lockfile
pnpm check            # typecheck, lint, format check, unit/integration tests, dev builds
pnpm test:browser     # Chromium smoke test with a synthetic service response
```

Development builds (`pnpm build`, output in `dist/`) use the local address `http://127.0.0.1:8787/analyze`. `pnpm serve` starts the Node development service; set `ANTHROPIC_API_KEY` and optionally `POND_MODEL` in your shell (default `claude-sonnet-5`). Never commit real secrets or copy them into build artifacts.

Production builds use the hosted endpoint in `deployment/production.json`:

```sh
pnpm build:production                        # dist/production/{chrome,edge,firefox}
pnpm test:live                               # Chrome: real service, real model, rendered opportunities
POND_LIVE_BUILD=edge pnpm test:live          # the Edge build in Chromium
POND_FIREFOX=/path/to/firefox pnpm test:live:firefox
pnpm release                                 # verified per-browser zips in release/
```

The live tests use the deployed service and paid real-model calls, with no mocks or request interception. Set `POND_CHROMIUM` to a full Chromium/Chrome binary if Playwright’s default headless shell cannot load extensions.

The 150-case diagnostic corpus and legacy/fallback reports remain available with `pnpm eval`. For remote evaluation, set `POND_ENDPOINT` and `POND_EXTENSION_ORIGIN=chrome-extension://mkcfmikjkimacobceplddcjmnfklppoc`. Evaluation uses the production quotas and makes paid real-model calls. The synthetic corpus is not an independently labeled real-world benchmark.
