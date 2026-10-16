(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const small = matchMedia('(max-width: 760px)');
  const root = document.documentElement;
  const header = document.querySelector('header');
  const hero = document.querySelector('.hero');
  const home = document.body.classList.contains('home-page');
  // Clip each photo independently, leaving the surrounding text in normal flow.
  document.querySelectorAll('.split > img').forEach(img => {
    const frame = document.createElement('div');
    frame.className = 'motion-photo';
    img.before(frame); frame.append(img);
    if (home) {
      frame.parentElement.classList.add('story-split');
      [...frame.parentElement.children].filter(child => child !== frame).forEach(child => child.classList.add('story-copy'));
    }
  });
  // Das Portalvideo behält den bisherigen Bild-/Textaufbau. Der interaktive
  // Player erhält keine Bild-Parallaxe; der Text läuft weiterhin daneben.
  if (home) document.querySelectorAll('.split > .portal-video').forEach(frame => {
    frame.parentElement.classList.add('story-split');
    [...frame.parentElement.children].filter(child => child !== frame).forEach(child => child.classList.add('story-copy'));
  });
  const eventGrid = home ? document.querySelector('.cards') : null;
  eventGrid?.classList.add('home-events');
  const photos = [...document.querySelectorAll('.motion-photo, .event-card .photo')];
  const targets = [...document.querySelectorAll('main h1, main h2, .hero .eyebrow, .hero .intro, .hero .actions, .page-head .lead, .section-top > p, .event-card, .price-card, .review-card, .social-card, .story-copy > p, .feature-list li, .band .button')];
  let revealObserver;
  let frameId = 0;
  let stopped = false;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function reveal() {
    revealObserver?.disconnect();
    targets.forEach(el => el.classList.remove('reveal-ready', 'is-revealed'));
    if (reduced.matches || !('IntersectionObserver' in window)) return;
    revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0, rootMargin:'0px 0px -28px 0px'});
    targets.forEach(el => {
      const rect = el.getBoundingClientRect();
      // Keep previously visited content visible when preferences change mid-page.
      if (rect.bottom < 0) return;
      if (el.matches('.event-card,.price-card,.review-card,.social-card,.feature-list li')) {
        const index = [...el.parentElement.children].indexOf(el);
        el.style.setProperty('--reveal-delay', `${small.matches ? 0 : index % 3 * 90}ms`);
      }
      el.querySelectorAll('.heading-word').forEach((line,index) => line.style.setProperty('--line-delay',`${index*120}ms`));
      el.classList.add('reveal-ready');
      revealObserver.observe(el);
    });
  }

  function draw() {
    frameId = 0;
    if (stopped) return;
    const viewport = innerHeight;
    const y = scrollY;
    const total = document.documentElement.scrollHeight - viewport;
    header?.classList.toggle('is-scrolled', y > 20);
    root.style.setProperty('--page-progress',total > 0 ? clamp(y/total,0,1).toFixed(4) : '0');
    if (reduced.matches) return;
    // Read geometry first, then write only transform/opacity custom properties.
    const heroRect = hero?.getBoundingClientRect();
    const photoRects = photos.map(el => ({el,rect:el.getBoundingClientRect()}));
    const eventRect = eventGrid?.getBoundingClientRect();
    if (heroRect && heroRect.bottom > 0 && heroRect.top < viewport) {
      const progress = clamp(-heroRect.top / heroRect.height,0,1);
      hero.style.setProperty('--hero-image-y',`${progress * (small.matches ? 32 : 110)}px`);
      hero.style.setProperty('--hero-copy-y',`${progress * (small.matches ? -12 : -45)}px`);
      hero.style.setProperty('--hero-scale',(1.07 + progress*.05).toFixed(3));
      hero.style.setProperty('--hero-opacity',String(1-progress*.35));
    }
    photoRects.forEach(({el,rect}) => {
      if (rect.bottom < -60 || rect.top > viewport+60) return;
      const position = clamp((viewport/2 - rect.top-rect.height/2)/(viewport/2+rect.height/2),-1,1);
      // Overscan (scale) always exceeds translation, so no empty edges appear.
      const distance = Math.min(rect.height*.045, small.matches ? 12 : 27);
      el.style.setProperty('--photo-y',`${(position*distance).toFixed(2)}px`);
    });
    if(eventRect) eventGrid.style.setProperty('--card-offset',`${(clamp((viewport-eventRect.top)/(viewport+eventRect.height),0,1)*38).toFixed(2)}px`);
  }
  function schedule() {
    if (!frameId && !stopped) frameId = requestAnimationFrame(draw);
  }
  function preferenceChanged() {
    root.classList.toggle('motion-active', !reduced.matches);
    reveal(); schedule();
  }
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  addEventListener('load',schedule,{once:true});
  addEventListener('pageshow',()=>{stopped=false;schedule();});
  addEventListener('pagehide',()=>{stopped=true;cancelAnimationFrame(frameId);frameId=0;});
  document.addEventListener('visibilitychange',()=>{stopped=document.hidden;if(stopped){cancelAnimationFrame(frameId);frameId=0;}else schedule();});
  reduced.addEventListener('change',preferenceChanged);
  small.addEventListener('change',schedule);
  // Keyboard navigation must never focus an invisible card or CTA.
  document.addEventListener('focusin',event=>{
    const target=event.target.closest('.reveal-ready');
    if(target){target.classList.add('is-revealed');revealObserver?.unobserve(target);}
  });
  preferenceChanged();
})();
