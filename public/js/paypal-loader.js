/**
 * PayPalLoader — lazily loads the PayPal JS SDK from the backend config.
 * Shared by member-portal.js and payments.js.
 */
const PayPalLoader = {
  _promise: null,

  load() {
    if (this._promise) return this._promise;
    this._promise = new Promise(async (resolve, reject) => {
      try {
        // Fetch client ID from backend so it never appears in static HTML
        const cfg = await fetch('/api/paypal/config').then(r => r.json());
        if (!cfg.clientId || cfg.clientId === 'YOUR_SANDBOX_CLIENT_ID_HERE' || cfg.clientId === 'YOUR_SANDBOX_CLIENT_ID') {
          return reject(new Error(
            'PayPal is not configured yet.\n\nAdd PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to docker-compose.yml, then rebuild.\n\nSee .env.example for instructions.'
          ));
        }
        // If SDK already injected, just resolve
        if (window.paypal) { resolve(); return; }
        if (document.getElementById('paypal-sdk')) {
          // Script tag exists but may still be loading
          document.getElementById('paypal-sdk').addEventListener('load', resolve);
          document.getElementById('paypal-sdk').addEventListener('error', () => reject(new Error('PayPal SDK failed to load')));
          return;
        }
        const currency  = cfg.currency || 'USD';
        const script    = document.createElement('script');
        script.id       = 'paypal-sdk';
        script.src      = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId)}&currency=${currency}&intent=capture`;
        script.onload   = resolve;
        script.onerror  = () => reject(new Error('PayPal SDK script failed to load. Check your Client ID.'));
        document.head.appendChild(script);
      } catch (e) {
        reject(e);
      }
    });
    return this._promise;
  },

  reset() {
    this._promise = null;
    const el = document.getElementById('paypal-sdk');
    if (el) el.remove();
  },
};
