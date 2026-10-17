/* One optional YouTube permission for this website. Players load only on click. */
(() => {
  if (new URLSearchParams(location.search).get('bearbeiten') === '1') return;
  const root = new URL(document.querySelector('.brand')?.getAttribute('href') || './', document.baseURI);
  const key = 'prometheus:youtube-consent:v1:' + root.pathname;
  const duration = 180 * 24 * 60 * 60 * 1000;
  const players = new Map();
  let storageAvailable = true;
  let choice = readChoice();
  let expiryTimer;
  let pendingVideo = null;
  let returnFocus = null;

  function readChoice() {
    let raw;
    try { raw = localStorage.getItem(key); }
    catch (_) { storageAvailable = false; return null; }
    try {
      const value = JSON.parse(raw);
      if (value?.version === 1 && typeof value.allowed === 'boolean' &&
          Number.isFinite(value.expiresAt) && value.expiresAt > Date.now() &&
          value.expiresAt <= Date.now() + duration) return value;
    } catch (_) { /* Invalid or outdated saved choices never grant permission. */ }
    return null;
  }

  const panel = document.createElement('dialog');
  panel.className = 'privacy-panel';
  panel.setAttribute('aria-labelledby', 'privacy-title');
  panel.setAttribute('aria-describedby', 'privacy-description');
  panel.innerHTML = `<h2 id="privacy-title">Cookies &amp; Videos</h2>
    <p id="privacy-description">Wir verwenden keine eigenen Analyse- oder Werbecookies. Unsere Videos kommen von YouTube (Google Ireland Limited). Beim Abspielen erhält Google unter anderem eure IP-Adresse, Geräteinformationen und Angaben zur Wiedergabe. Google kann diese Daten für eigene Zwecke verarbeiten und Informationen auf eurem Gerät speichern oder auslesen. Eine Verarbeitung in den USA und eine Zuordnung zu eurem Google-Konto sind möglich.</p>
    <p>Ihr entscheidet freiwillig, ob ihr YouTube-Videos auf dieser Website erlaubt. Wir merken uns eure Auswahl für 180 Tage in diesem Browser. Ihr könnt sie jederzeit unten über „Datenschutzeinstellungen“ ändern.</p>
    <p class="privacy-status" role="status"></p>
    <div class="privacy-actions"><button type="button" class="button ghost privacy-allow">YouTube erlauben</button><button type="button" class="button ghost privacy-deny">Nur notwendige</button></div>
    <div class="privacy-links"><a class="text-link privacy-details">Datenschutz</a><a class="text-link privacy-imprint">Impressum</a><button type="button" class="privacy-back" hidden>Zurück</button></div>`;
  panel.querySelector('.privacy-details').href = new URL('datenschutz/#youtube', root).href;
  panel.querySelector('.privacy-imprint').href = new URL('impressum/', root).href;
  document.body.append(panel);
  const status = panel.querySelector('.privacy-status');
  const deny = panel.querySelector('.privacy-deny');
  const back = panel.querySelector('.privacy-back');

  function stopVideos() {
    players.forEach(({button, close}, frame) => {
      frame.replaceWith(button);
      close.remove();
    });
    players.clear();
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    if (!choice) return;
    expiryTimer = setTimeout(() => {
      if (choice && choice.expiresAt <= Date.now()) {
        choice = null;
        stopVideos();
      }
      scheduleExpiry();
    }, Math.min(choice.expiresAt - Date.now(), 2147483647));
  }

  function remember(allowed) {
    choice = {version: 1, allowed, expiresAt: Date.now() + duration};
    try { localStorage.setItem(key, JSON.stringify(choice)); }
    catch (_) { storageAvailable = false; }
    if (!allowed) stopVideos();
    scheduleExpiry();
  }

  function play(button) {
    if (!choice?.allowed || choice.expiresAt <= Date.now() || !button.isConnected) return;
    const id = button.dataset.video;
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    const container = button.parentElement;
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
    frame.title = button.dataset.title || 'Showvideo';
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    button.replaceWith(frame);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'video-close';
    close.textContent = 'Video schließen';
    close.addEventListener('click', () => {
      frame.replaceWith(button);
      close.remove();
      players.delete(frame);
      button.focus({preventScroll: true});
    });
    players.set(frame, {button, close});
    container.insertAdjacentElement('afterend', close);
    close.focus({preventScroll: true});
  }

  function dismiss(restoreFocus = true) {
    if (panel.open) panel.close();
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    pendingVideo = null;
  }

  function openSettings(button = null, initial = false) {
    pendingVideo = button;
    returnFocus = button || document.activeElement;
    status.textContent = choice?.allowed ? 'Aktuell: YouTube erlaubt.' :
      choice ? 'Aktuell: YouTube deaktiviert.' : 'YouTube ist bis zu eurer Zustimmung deaktiviert.';
    deny.textContent = choice?.allowed ? 'YouTube deaktivieren' : 'Nur notwendige';
    back.hidden = initial;
    if (panel.open) panel.close();
    if (initial) panel.show(); else panel.showModal();
  }

  panel.querySelector('.privacy-allow').addEventListener('click', () => {
    const requested = pendingVideo;
    remember(true);
    dismiss(!requested);
    if (requested) play(requested);
  });
  deny.addEventListener('click', () => { remember(false); dismiss(); });
  back.addEventListener('click', () => dismiss());
  panel.addEventListener('cancel', event => {event.preventDefault(); dismiss();});
  document.querySelectorAll('[data-privacy-settings]').forEach(button => {
    button.addEventListener('click', () => openSettings());
  });
  document.querySelectorAll('.video-load').forEach(button => {
    button.addEventListener('click', () => {
      if (choice && choice.expiresAt <= Date.now()) {choice = null; stopVideos();}
      if (choice?.allowed) play(button); else openSettings(button);
    });
  });
  // Also apply revocation to other tabs and back/forward restored pages.
  addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    storageAvailable = true;
    choice = readChoice();
    if (!choice?.allowed) stopVideos();
    if (choice?.allowed && panel.open) dismiss();
    else if (panel.open) {
      status.textContent = 'Aktuell: YouTube deaktiviert.';
      deny.textContent = 'Nur notwendige';
    }
    scheduleExpiry();
  });
  addEventListener('pageshow', () => {
    if (storageAvailable) choice = readChoice();
    if (!choice?.allowed || choice.expiresAt <= Date.now()) stopVideos();
    scheduleExpiry();
  });
  scheduleExpiry();
  if (!choice) openSettings(null, true);
})();
