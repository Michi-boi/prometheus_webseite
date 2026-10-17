const toggle = document.querySelector('.menu');
const nav = document.querySelector('#navigation');
toggle?.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && nav?.classList.contains('open')) {nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.focus();} });
const form = document.querySelector('#anfrage');
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
