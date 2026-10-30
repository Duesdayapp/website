# duesdayapp.com

The Duesday waitlist website: a plain HTML page, no build step. Hosted free on GitHub Pages.

- `index.html` + `app.js`: the waitlist. Signups go to Supabase through `join_waitlist()`.
- `privacy.html`, `support.html`: draft pages (finalized before the App Store submission).
- `style.css`: colours match the Duesday app.

The Supabase key in `app.js` is the **publishable** key, which is meant to be public. Never put a secret key here.
