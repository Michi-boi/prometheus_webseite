const toggle = document.querySelector('.menu');
const nav = document.querySelector('#navigation');
toggle?.addEventListener('click', () => { const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); });
document.addEventListener('keydown', e => { if(e.key === 'Escape' && nav?.classList.contains('open')) {nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.focus();} });
document.querySelectorAll('[data-random-gallery]').forEach(gallery => {
  const slides = [...gallery.querySelectorAll('.slideshow-slide')];
  if (!slides.length) return;
  const requestedInterval = Number(gallery.dataset.interval);
  const interval = Number.isFinite(requestedInterval) && requestedInterval >= 1000 ? requestedInterval : 3000;
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
      timer = setTimeout(() => {choose();schedule();},interval);
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
