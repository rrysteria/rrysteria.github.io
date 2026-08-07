const formAvailabilityAreas = [
  ...document.querySelectorAll("[data-form-availability]"),
];

function showAvailableForm(area) {
  const checkingMessage = area.querySelector("[data-form-checking]");
  const form = area.querySelector("[data-enquiry-form]");
  const fallback = area.querySelector("[data-form-fallback]");

  if (checkingMessage) checkingMessage.hidden = true;
  if (fallback) fallback.hidden = true;
  if (form) form.hidden = false;
  area.setAttribute("aria-busy", "false");
}

function showEmailFallback(area) {
  const checkingMessage = area.querySelector("[data-form-checking]");
  const form = area.querySelector("[data-enquiry-form]");
  const fallback = area.querySelector("[data-form-fallback]");

  if (checkingMessage) checkingMessage.hidden = true;
  if (form) form.hidden = true;
  if (fallback) fallback.hidden = false;
  area.setAttribute("aria-busy", "false");
}

function statusAllowsTheForm(status) {
  const checkedAt = Date.parse(status.checkedAt);
  const validUntil = Date.parse(status.validUntil);
  const now = Date.now();
  const clockTolerance = 5 * 60 * 1000;

  const statusIsCurrent =
    Number.isFinite(checkedAt) &&
    Number.isFinite(validUntil) &&
    checkedAt <= now + clockTolerance &&
    validUntil >= now;

  return (
    statusIsCurrent &&
    status.databaseOnline === true &&
    status.formReleased === true &&
    status.formAvailable === true
  );
}

async function getFormAvailability() {
  const statusUrl = new URL("supabase-status.json", document.baseURI);
  statusUrl.searchParams.set("time", String(Date.now()));

  const response = await fetch(statusUrl, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) throw new Error("The form status request failed.");

  const status = await response.json();
  return statusAllowsTheForm(status);
}

if (formAvailabilityAreas.length) {
  formAvailabilityAreas.forEach((area) => {
    const checkingMessage = area.querySelector("[data-form-checking]");
    if (checkingMessage) checkingMessage.hidden = false;
    area.setAttribute("aria-busy", "true");
  });

  getFormAvailability()
    .then((formIsAvailable) => {
      formAvailabilityAreas.forEach((area) => {
        if (formIsAvailable) showAvailableForm(area);
        else showEmailFallback(area);
      });
    })
    .catch(() => {
      formAvailabilityAreas.forEach(showEmailFallback);
    });
}

document.addEventListener("romilia:form-offline", (event) => {
  if (!(event.target instanceof Element)) return;
  const area = event.target.closest("[data-form-availability]");
  if (area) showEmailFallback(area);
});
