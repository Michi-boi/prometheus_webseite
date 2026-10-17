/* Public form endpoint only: no API key, SMTP password or customer data in this file. */
(() => {
  const form = document.querySelector('#anfrage');
  if (!form) return;
  const kind = form.querySelector('[name="art"]');
  const other = form.querySelector('#sonstige-art');
  const status = document.querySelector('#form-status');
  const submit = form.querySelector('button[type="submit"]');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.protocol === 'file:';
  let sending = false;
  function syncOther() {
    other.hidden = kind.value !== 'Sonstiges';
    other.querySelector('input').required = !other.hidden;
    other.querySelector('input').disabled = other.hidden;
  }
  kind.addEventListener('change', syncOther);
  syncOther();
  addEventListener('pageshow', () => {
    sending = false; submit.disabled = false; syncOther();
    if (status.textContent === 'Eure Anfrage wird gesendet …') status.textContent = '';
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !form.reportValidity()) return;
    if (local) {
      status.textContent = 'In der lokalen Vorschau werden keine Anfragen versendet. Bitte verwendet dafür das Formular auf unserer veröffentlichten Website.';
      return;
    }
    if (form.querySelector('[name="_gotcha"]')?.value) {
      status.textContent = 'Die Anfrage konnte nicht gesendet werden. Ihr erreicht uns auch unter info@prometheus-feuershow.de.';
      return;
    }
    sending = true;
    submit.disabled = true;
    status.textContent = 'Eure Anfrage wird gesendet …';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let accepted = false;
    try {
      const data = new FormData(form);
      const date = data.get('datum');
      // Keep the date input's ISO value; format only the submitted message.
      // Rearrange the parts directly to avoid any timezone conversion.
      if (typeof date === 'string' && /^\d{4,}-\d{2}-\d{2}$/.test(date)) {
        data.set('datum', date.split('-').reverse().join('.'));
      }
      const response = await fetch(form.action, {
        method: 'POST', body: data,
        headers: {Accept: 'application/json'}, signal: controller.signal,
        credentials: 'omit'
      });
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('Der Versand konnte nicht bestätigt werden. Eure Eingaben bleiben erhalten. Bitte kontaktiert uns direkt unter info@prometheus-feuershow.de.');
      }
      const result = await response.json();
      if (!response.ok || result.success !== true) {
        const message = typeof result.error_msg === 'string' ? result.error_msg :
          typeof result.error === 'string' ? result.error : '';
        throw new Error(message || 'Die Anfrage konnte nicht gesendet werden. Eure Eingaben bleiben erhalten. Bitte kontaktiert uns unter info@prometheus-feuershow.de.');
      }
      // Only a positive acknowledgement leads to the thank-you page.
      const root = new URL(document.querySelector('.brand').getAttribute('href'), document.baseURI);
      location.assign(new URL('kontakt/danke/', root).href);
      accepted = true;
    } catch (error) {
      status.textContent = ['AbortError', 'SyntaxError', 'TypeError'].includes(error.name) ?
        'Der Versand konnte nicht bestätigt werden. Eure Eingaben bleiben erhalten. Ihr erreicht uns auch unter info@prometheus-feuershow.de.' : error.message;
    } finally {
      clearTimeout(timeout);
      if (!accepted) {sending = false; submit.disabled = false;}
    }
  });
})();
