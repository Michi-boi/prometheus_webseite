const toggle = document.querySelector('.menu');
const nav = document.querySelector('#navigation');
toggle?.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && nav?.classList.contains('open')) {nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.focus();} });
const form = document.querySelector('#anfrage');
const siteRoot = new URL(document.querySelector('.brand')?.getAttribute('href') || './', document.baseURI);
document.querySelectorAll('.video-load').forEach(button => {
  button.addEventListener('click', () => {
    const id = button.dataset.video;
    if(!/^[\w-]{11}$/.test(id)) return;
    const container = button.parentElement;
    if(container.querySelector('.video-consent')) return;
    const consent = document.createElement('div');
    consent.className = 'video-consent';
    consent.innerHTML = '<p><strong>Video von YouTube laden?</strong></p><p>Mit dem Laden stimmt ihr zu, dass Daten wie eure IP-Adresse an Google übertragen werden. Eine Verarbeitung in den USA und Speicherzugriffe auf eurem Gerät sind möglich. <a href="/datenschutz/#youtube">Mehr zum Datenschutz</a></p><div class="actions"><button type="button" class="button video-accept">YouTube-Video laden</button><button type="button" class="button ghost video-cancel">Abbrechen</button></div>';
    consent.querySelector('a').href = new URL('datenschutz/#youtube', siteRoot).href;
    container.append(consent);
    consent.querySelector('.video-cancel').addEventListener('click',()=>{consent.remove();button.focus()});
    const accept = consent.querySelector('.video-accept');
    accept.addEventListener('click',()=>{
      const player = document.createElement('iframe');
      player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      player.title = button.dataset.title;
      player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      player.allowFullscreen = true;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      consent.remove();button.replaceWith(player);
      const close = document.createElement('button');
      close.type = 'button';close.className = 'video-close';close.textContent = 'YouTube-Video schließen';
      close.addEventListener('click',()=>{player.replaceWith(button);close.remove();button.focus()});
      container.insertAdjacentElement('afterend',close);
      close.focus();
    });
    accept.focus();
  });
});
document.querySelectorAll('[data-random-gallery]').forEach(gallery => {
  const slides = [...gallery.querySelectorAll('.slideshow-slide')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let current = -1;
  let order = [];
  let timer;
  let visible = !('IntersectionObserver' in window);
  function choose() {
    if (!order.length) {
      order = slides.map((slide,index) => index);
      for (let i=order.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [order[i],order[j]]=[order[j],order[i]];
      }
      // Each picture appears once per round; no repetition between rounds.
      if (order.length>1 && order[order.length-1]===current) {
        [order[0],order[order.length-1]]=[order[order.length-1],order[0]];
      }
    }
    current = order.pop();
    slides.forEach((slide,index) => {
      slide.classList.toggle('is-current',index===current);
      slide.setAttribute('aria-hidden',String(index!==current));
    });
    gallery.dataset.currentSlide = String(current);
  }
  function schedule() {
    clearTimeout(timer);
    if (slides.length>1 && visible && !document.hidden && !reduced.matches) {
      timer = setTimeout(() => {choose();schedule();},3000);
    }
  }
  choose();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      schedule();
    },{threshold:0.15}).observe(gallery);
  }
  reduced.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',schedule);
  addEventListener('pagehide',()=>clearTimeout(timer));
  addEventListener('pageshow',schedule);
  schedule();
});
if(form) {
  const kind = form.querySelector('[name="art"]');
  const other = form.querySelector('#sonstige-art');
  kind.addEventListener('change', () => {other.hidden = kind.value !== 'Sonstiges'; other.querySelector('input').required = !other.hidden;});
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if(!form.reportValidity()) return;
    const status = document.querySelector('#form-status');
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true; status.textContent = 'Deine Anfrage wird gesendet …';
    try {
      const response = await fetch(form.action, {method:'POST',body:new FormData(form),headers:{Accept:'application/json'}});
      const type = response.headers.get('content-type') || '';
      if(!type.includes('application/json')) throw new Error('Der Formularversand ist hier noch nicht verfügbar. Schreibe uns bitte an info@prometheus-feuershow.de.');
      const result = await response.json();
      if(!response.ok) throw new Error(result.message || 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.');
      status.textContent = result.message; form.reset(); other.hidden = true; other.querySelector('input').required = false;
    } catch(error) {status.textContent = error.message === 'Failed to fetch' ? 'Keine Verbindung. Deine Eingaben bleiben erhalten. Bitte versuche es erneut oder schreibe an info@prometheus-feuershow.de.' : error.message;}
    finally {submit.disabled = false;}
  });
}
