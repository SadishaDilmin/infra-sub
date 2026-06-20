/**
 * Client-side helper to redirect the browser to PayHere's hosted checkout.
 *
 * PayHere's checkout is a classic form POST. We build a hidden form from the
 * server-provided fields (which already include the server-computed `hash`) and
 * submit it, navigating the user to PayHere. We never compute the hash in the
 * browser — that would leak the merchant secret.
 */
export function submitPayhereCheckout(
  actionUrl: string,
  fields: Record<string, string>,
): void {
  if (typeof document === "undefined") return;
  const form = document.createElement("form");
  form.method = "POST";
  form.action = actionUrl;
  form.style.display = "none";

  for (const [key, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}
