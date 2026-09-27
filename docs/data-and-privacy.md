# Data and privacy

Website access and hosted issue recognition are separate opt-ins. The normal Settings UI contains website permissions, coarse location, and a recognition consent switch—no server address, token, or API-key field. The production service address is compiled into the extension after deployment; no request uses an address supplied by webpage content.

Without recognition consent, extraction stays in the browser. With consent, Pond sends its hosted service up to 16,000 characters in structured blocks: visible text, titles, selected metadata, domain (no full URL path/query), language and focus. No raw HTML, forms, editable text, cookies or user location is included. This is minimization, not anonymization: article text can contain personal information. The server forwards the extract and taxonomy to Anthropic for analysis. Provider retention depends on the owner’s API account/service terms.

Provider keys exist only in server environment secrets. The extension has no provider key or shared backend secret. Its manifest public key gives Chrome installations a stable ID; it is not a secret or proof of authorization. The anonymous endpoint uses origin filtering, rate limits and durable daily call caps to limit abuse.

Pond does not persist raw browsing history, page extracts or returned analysis. Current-page snapshots and bounded analysis caches are transient browser memory. The service’s quota storage (a Cloudflare Durable Object) holds counts and daily salted HMACs of hashed client IPs; it stores neither raw IPs nor page content. Cloudflare’s network/infrastructure logs may process request metadata under its policies; application logs deliberately exclude it. No analytics or advertising integration is present.

Persistent extension settings store website scopes, explicit coarse user location and recognition consent. Old endpoint/session-token settings are cleared when settings are saved and are no longer used. Content location remains distinct from user location. No precise geolocation or political profiles are collected.

Removing website access stops scripts, clears transient state, cancels analysis and unregisters content scripts. Withdrawing recognition consent prevents subsequent model requests; it cannot retract an extract already sent. Users can continue manual issue exploration with recognition disabled.
