/**
 * StripeLoader — lazily loads Stripe.js and fetches publishable key from backend.
 * Shared by member-portal.js and payments.js.
 */
const StripeLoader = {
  _promise: null,
  _stripe:  null,

  load() {
    if (this._promise) return this._promise;
    this._promise = new Promise(async (resolve, reject) => {
      try {
        const cfg = await fetch('/api/stripe/config').then(r => r.json());
        if (!cfg.publishableKey || cfg.publishableKey.includes('YOUR_KEY')) {
          return reject(new Error(
            'Stripe is not configured.\n\nAdd STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to docker-compose.yml, then rebuild.'
          ));
        }

        // Load Stripe.js if not already present
        if (!window.Stripe) {
          await new Promise((res, rej) => {
            if (document.getElementById('stripe-js')) {
              document.getElementById('stripe-js').addEventListener('load', res);
              return;
            }
            const s   = document.createElement('script');
            s.id      = 'stripe-js';
            s.src     = 'https://js.stripe.com/v3/';
            s.onload  = res;
            s.onerror = () => rej(new Error('Stripe.js failed to load'));
            document.head.appendChild(s);
          });
        }

        this._stripe = window.Stripe(cfg.publishableKey);
        this._cfg    = cfg;
        resolve({ stripe: this._stripe, cfg });
      } catch (e) {
        reject(e);
      }
    });
    return this._promise;
  },

  reset() {
    this._promise = null;
    this._stripe  = null;
  },
};
