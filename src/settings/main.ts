import { geographicLocationSchema } from "../intelligence/contracts";
import { extensionAPI, ordinaryOrigin } from "../platform/extension-api";
import {
  requestWebsiteAccess,
  WEBSITE_ORIGINS,
  grantedWebsiteOrigins,
} from "../runtime/permissions";
const api = extensionAPI();
const status = document.querySelector<HTMLElement>("#settings-status")!;
const report = async () => {
  const origins = await grantedWebsiteOrigins(api);
  status.textContent = origins.length
    ? `Automatic access enabled for: ${origins.join(", ")}. You can open Pond on those pages without granting access again.`
    : "Automatic website access is not enabled. Choose all supported sites or add a site below.";
};
document.querySelector("#enable-all")!.addEventListener("click", () => {
  void requestWebsiteAccess(api, WEBSITE_ORIGINS)
    .then((granted) => {
      if (granted) void report();
      else
        status.textContent =
          "Access was not granted. You can keep browsing and enable it here later.";
    })
    .catch(() => {
      status.textContent =
        "Access could not be enabled. Try again from this settings page.";
    });
});
document.querySelector("#enable-site")!.addEventListener("click", () => {
  const value = document.querySelector<HTMLInputElement>("#site")!.value;
  const origin = ordinaryOrigin(value);
  if (!origin) {
    status.textContent =
      "Enter a complete http:// or https:// website address.";
    return;
  }
  void requestWebsiteAccess(api, [origin])
    .then(() => report())
    .catch(() => {
      status.textContent = "Site access could not be enabled.";
    });
});
document.querySelector("#disable-access")!.addEventListener("click", () => {
  void (async () => {
    const origins = await grantedWebsiteOrigins(api);
    await api.storage.local.set({ websiteOrigins: [] });
    if (origins.length) await api.permissions.remove({ origins });
    await api.runtime.sendMessage({ type: "RECONCILE_ACCESS" });
    await report();
  })().catch(() => {
    status.textContent =
      "Could not remove access. You can also change site permissions in your browser settings.";
  });
});
void report();
const field = (id: string) =>
  document.querySelector<HTMLInputElement>(`#${id}`)!;
void api.storage.local
  .get(["userLocation", "semanticConsent"])
  .then((value) => {
    const location = value.userLocation as
      { city?: string; state?: string; country?: string } | undefined;
    field("city").value = location?.city ?? "";
    field("region").value = location?.state ?? "";
    field("country").value = location?.country ?? "";
    field("consent").checked = value.semanticConsent === true;
  });
document.querySelector("#save-settings")!.addEventListener("click", () => {
  void (async () => {
    const city = field("city").value.trim(),
      state = field("region").value.trim(),
      country = field("country").value.trim().toUpperCase();
    const userLocation = geographicLocationSchema.nullable().parse(
      city || state || country
        ? {
            city: city || null,
            state: state || null,
            country: country || null,
            county: null,
            coordinates: null,
            confidence: 1,
            provenance: "explicit_user",
            evidenceIds: [],
          }
        : null,
    );
    await api.storage.local.set({
      semanticConsent: field("consent").checked,
      userLocation,
    });
    await api.storage.local.remove("endpoint");
    await api.storage.session?.set({ serviceToken: "" });
    await api.runtime.sendMessage({ type: "SETTINGS_CHANGED" });
    status.textContent =
      "Settings saved. Location stays separate from the places mentioned on a page.";
  })().catch((error) => {
    status.textContent =
      error instanceof Error ? error.message : "Could not save settings.";
  });
});
