/**
 * Client-side helper to send the browser to Polar's hosted checkout.
 *
 * Unlike PayHere (a form POST), Polar returns a hosted checkout URL that we
 * simply navigate to. The URL is created server-side, so no secret is exposed.
 */
export function redirectToPolarCheckout(url: string): void {
  if (typeof window === "undefined") return;
  window.location.href = url;
}
