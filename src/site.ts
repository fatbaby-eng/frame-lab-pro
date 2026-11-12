// The site Frame Lab belongs to: where "back" goes, and the credit that rides
// on everything it renders out.

/** The credit drawn into every exported video and GIF. */
export const CREDIT = 'Made with Frame Lab · toddboswell.com';

/** Back to the site's shelf of tools. Same-origin on the site itself (and in a local preview of it). */
export function siteHome(): string {
  const host = typeof location === 'undefined' ? '' : location.hostname;
  const onSite = /(^|\.)toddboswell\.com$/.test(host) || host === 'localhost' || host === '127.0.0.1';
  return onSite ? '/#workshop' : 'https://toddboswell.com/#workshop';
}

/**
 * True when Frame Lab is the page itself. Inside the homepage's overlay it is
 * framed, and the overlay has its own way back, so the editor shows none.
 */
export function isStandalone(): boolean {
  try { return window.self === window.top; } catch { return false; }
}
