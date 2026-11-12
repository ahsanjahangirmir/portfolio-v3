import gsap from 'gsap';
import Lenis from 'lenis';
import { toggleTheme } from './theme';

let dispose: (() => void) | undefined;
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');

function onPage() {
  dispose?.();
  const reduced = motionPreference.matches;
  const cleanups: (() => void)[] = [];
  const context = gsap.context(() => {
    if (!reduced) {
      const intro = gsap.timeline({defaults:{ease:'power3.out'}});
      intro.from('.hero-line > span', {yPercent:110, duration:1, stagger:.085}, 0)
        .from('.signal-caption, .hero-bottom', {opacity:0, y:12, duration:.7, stagger:.1}, .3)
        .from('.not-found h1', {y:26, opacity:0, duration:.75, clearProps:'all'}, 0);
    }
  });

  const themeButton = document.querySelector<HTMLButtonElement>('.theme-toggle');
  themeButton?.addEventListener('click', toggleTheme);
  cleanups.push(() => themeButton?.removeEventListener('click', toggleTheme));

  let lenis: Lenis | undefined;
  if (!reduced) {
    lenis = new Lenis({anchors:true, duration:.95});
    const scrollTick = (t:number) => lenis?.raf(t*1000);
    gsap.ticker.add(scrollTick);
    cleanups.push(() => { gsap.ticker.remove(scrollTick); lenis?.destroy(); });

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        context.add(() => gsap.to(entry.target, {opacity:1, y:0, duration:.85, ease:'power3.out',clearProps:'opacity,transform'}));
        observer.unobserve(entry.target);
      }
    }, {threshold:.08});
    context.add(() => {
      document.querySelectorAll('.project, .index-head, .index-row, .about h2, .contact-links').forEach((element) => {
        if (element.getBoundingClientRect().top > innerHeight * .95) {
          gsap.set(element, {y:30, opacity:0});
          observer.observe(element);
        }
      });
    });
    cleanups.push(() => observer.disconnect());

    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll<HTMLElement>('.project-cover').forEach((cover) => {
        const art = cover.querySelector<HTMLElement>('.shot');
        if (!art) return;
        let xTo: (value:number) => void = () => {};
        let yTo: (value:number) => void = () => {};
        let rotationTo: (value:number) => void = () => {};
        context.add(() => {
          xTo = gsap.quickTo(art, 'x', {duration:.65, ease:'power3.out'});
          yTo = gsap.quickTo(art, 'y', {duration:.65, ease:'power3.out'});
          rotationTo = gsap.quickTo(art, 'rotation', {duration:.65, ease:'power3.out'});
        });
        const move = (event: PointerEvent) => {
          const rect = cover.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width - .5;
          const y = (event.clientY - rect.top) / rect.height - .5;
          xTo(x*10); yTo(y*8); rotationTo(x*.8);
        };
        const reset = () => { xTo(0); yTo(0); rotationTo(0); };
        cover.addEventListener('pointermove', move);
        cover.addEventListener('pointerleave', reset);
        cleanups.push(() => {cover.removeEventListener('pointermove', move);cover.removeEventListener('pointerleave', reset);});
      });
    }
  }

  // Index preview: the hovered product resolves beside the pointer; keyboard and reduced motion pin it to the row.
  const index = document.querySelector<HTMLElement>('.index');
  const preview = index?.querySelector<HTMLElement>('.index-preview');
  if (index && preview && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const images = new Map([...preview.querySelectorAll<HTMLImageElement>('img')].map(img => [img.dataset.slug, img]));
    const duration = reduced ? 0 : .6;
    // Hidden lazy images never load on their own; fetch them as the index approaches so the first hover isn't blank.
    const warm = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      images.forEach(img => { img.loading = 'eager'; });
      warm.disconnect();
    }, {rootMargin:'600px 0px'});
    warm.observe(index);
    cleanups.push(() => warm.disconnect());
    let active: HTMLImageElement | undefined;
    let layer = 1;
    let xTo: (value:number) => void = () => {};
    let yTo: (value:number) => void = () => {};
    context.add(() => {
      xTo = gsap.quickTo(preview, 'x', {duration:reduced ? 0 : .7, ease:'power3.out'});
      yTo = gsap.quickTo(preview, 'y', {duration:reduced ? 0 : .7, ease:'power3.out'});
    });
    const place = (x:number, y:number, jump=false) => {
      const box = index.getBoundingClientRect();
      const width = preview.offsetWidth, height = preview.offsetHeight;
      // Sit right of the pointer, flipping left past the middle so the preview never leaves the column.
      const left = x - box.left > box.width * .55 ? x - box.left - width - 36 : x - box.left + 36;
      const top = Math.min(Math.max(y - box.top - height / 2, 0), box.height - height);
      if (jump) context.add(() => gsap.set(preview, {x:left, y:top}));
      xTo(left); yTo(top);
    };
    const show = (slug?:string) => {
      const image = images.get(slug);
      if (!image || image === active) return;
      context.add(() => {
        if (active) gsap.to(active, {clipPath:'inset(0% 0% 100% 0%)', duration, ease:'power3.out', overwrite:true});
        gsap.set(preview, {visibility:'visible'});
        gsap.set(image, {zIndex:++layer});
        gsap.fromTo(image, {clipPath:'inset(100% 0% 0% 0%)'}, {clipPath:'inset(0% 0% 0% 0%)', duration, ease:'power3.out', overwrite:true});
      });
      active = image;
    };
    const hide = () => {
      if (!active) return;
      const image = active;
      active = undefined;
      context.add(() => gsap.to(image, {clipPath:'inset(0% 0% 100% 0%)', duration:reduced ? 0 : .45, ease:'power3.out', overwrite:true, onComplete:() => { if (!active) gsap.set(preview, {visibility:'hidden'}); }}));
    };
    const pinTo = (link:HTMLElement) => {
      const row = link.getBoundingClientRect();
      place(row.left + row.width * .62, row.top + row.height / 2, !active);
    };
    const links = [...index.querySelectorAll<HTMLAnchorElement>('[data-preview]')];
    const enter = (event:PointerEvent) => {
      const link = event.currentTarget as HTMLAnchorElement;
      if (reduced) pinTo(link); else place(event.clientX, event.clientY, !active);
      show(link.dataset.preview);
    };
    const move = (event:PointerEvent) => { if (!reduced) place(event.clientX, event.clientY); };
    const focus = (event:FocusEvent) => {
      const link = event.currentTarget as HTMLAnchorElement;
      if (!link.matches(':focus-visible')) return;
      pinTo(link); show(link.dataset.preview);
    };
    const list = index.querySelector<HTMLElement>('.index-list');
    links.forEach(link => { link.addEventListener('pointerenter', enter); link.addEventListener('focus', focus); link.addEventListener('blur', hide); });
    list?.addEventListener('pointermove', move);
    list?.addEventListener('pointerleave', hide);
    cleanups.push(() => {
      links.forEach(link => { link.removeEventListener('pointerenter', enter); link.removeEventListener('focus', focus); link.removeEventListener('blur', hide); });
      list?.removeEventListener('pointermove', move);
      list?.removeEventListener('pointerleave', hide);
    });
  }

  const canvas = document.querySelector<HTMLCanvasElement>('#signal');
  const button = document.querySelector<HTMLButtonElement>('#signal-toggle');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const dispersed = button?.getAttribute('aria-pressed') === 'true';
    const state = {spread:dispersed ? 1 : reduced ? 0 : .55, px:0, py:0, presence:0};
    if (!reduced) context.add(() => gsap.to(state, {spread:dispersed ? 1 : 0, duration:1.6, ease:'power3.out'}));
    const dots = Array.from({length:1050}, (_,i) => {
      const y=1-i/1049*2, r=Math.sqrt(1-y*y), a=i*2.399963;
      return {x:Math.cos(a)*r, y, z:Math.sin(a)*r, dx:Math.sin(i*17.13), dy:Math.cos(i*11.71), dz:Math.sin(i*7.39)};
    });
    let size=0, height=0, visible=true, particleColor='217,65,24';
    const resizeCanvas = () => {
      const rect=canvas.getBoundingClientRect();
      size=rect.width; height=rect.height;
      const ratio=Math.min(devicePixelRatio,2);
      canvas.width=Math.round(size*ratio); canvas.height=Math.round(height*ratio);
      ctx?.setTransform(ratio,0,0,ratio,0,0);
    };
    // Size the backing store before the first draw, including reduced motion.
    resizeCanvas();
    const syncColor = () => {
      particleColor=getComputedStyle(document.documentElement).getPropertyValue('--particle').trim() || particleColor;
      if (reduced) draw(0);
    };
    syncColor();
    const resize = new ResizeObserver(() => {
      resizeCanvas();
      if (reduced) draw(0);
    });
    resize.observe(canvas);
    const observer = new IntersectionObserver(([entry]) => visible=entry.isIntersecting);
    observer.observe(canvas);

    function draw(t:number) {
      if (!ctx || !canvas || (!visible && !reduced) || document.hidden) return;
      const h=height;
      if (size<=0 || h<=0) return;
      ctx.clearRect(0,0,size,h);
      const angle=t*.065+state.px*.55;
      const c=Math.cos(angle), s=Math.sin(angle), tilt=-.16+state.py*.35;
      let extent=0;
      const rotated=dots.map((p) => {
        const x=p.x+state.spread*p.dx*.58, y=p.y+state.spread*p.dy*.58, z=p.z+state.spread*p.dz*.58;
        extent=Math.max(extent,Math.hypot(x,y,z));
        const rx=x*c+z*s, rz=z*c-x*s;
        return {x:rx, y:y*Math.cos(tilt)-rz*Math.sin(tilt), z:y*Math.sin(tilt)+rz*Math.cos(tilt)};
      });
      // Fit an enclosing sphere after perspective. Its bound is independent of
      // rotation, so pointer movement cannot clip the field or make its scale pulse.
      const focalDistance=2.8/.27;
      const projectedExtent=extent/Math.sqrt(1-(extent/focalDistance)**2);
      const padding=Math.max(12,Math.min(size,h)*.04);
      const radius=Math.min(Math.min(size,h)*.365,(Math.min(size,h)/2-padding)/projectedExtent);
      const dotScale=Math.min(size,h)/500;
      const points=rotated.map((p) => {
        const perspective=focalDistance/(focalDistance-p.z);
        return {x:size/2+p.x*radius*perspective, y:h/2+p.y*radius*perspective, z:p.z};
      }).sort((a,b) => a.z-b.z);
      // Reveal relationships locally around the pointer, keeping the entire field quiet.
      if (state.presence>.01) {
        const focusX=(state.px+.5)*size, focusY=(state.py+.5)*h;
        const near=points.filter(p => p.z>0 && Math.hypot(p.x-focusX,p.y-focusY)<size*.16).slice(-22);
        ctx.strokeStyle='rgba('+particleColor+','+(.24*state.presence)+')';
        ctx.lineWidth=.65;
        ctx.beginPath();
        near.forEach((p,i) => {
          for (let j=i+1;j<near.length;j++) if (Math.hypot(p.x-near[j].x,p.y-near[j].y)<size*.085) {
            ctx.moveTo(p.x,p.y);ctx.lineTo(near[j].x,near[j].y);
          }
        });
        ctx.stroke();
      }
      for (const p of points) {
        ctx.fillStyle='rgba('+particleColor+','+(.2+(p.z+1)*.32)+')';
        ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.5,dotScale*(1.1+(p.z+1)*.6)),0,Math.PI*2);ctx.fill();
      }
    }
    draw(0);canvas.parentElement?.classList.add('canvas-ready');
    const pointer=(event:PointerEvent) => {
      if(event.pointerType==='touch')return;
      const rect=canvas.getBoundingClientRect();
      gsap.to(state,{px:(event.clientX-rect.left)/rect.width-.5, py:(event.clientY-rect.top)/rect.height-.5, presence:1, duration:.65, ease:'power3.out',overwrite:'auto'});
    };
    const reset=() => gsap.to(state,{px:0,py:0,presence:0,duration:1,ease:'power3.out',overwrite:'auto'});
    const toggle=() => {
      const active=button?.getAttribute('aria-pressed')!=='true';
      button?.setAttribute('aria-pressed',String(active));
      if(button)button.innerHTML=(active?'Connect':'Disperse')+' <span>↗</span>';
      if(reduced){state.spread=active?1:0;draw(0);}
      else gsap.to(state,{spread:active?1:0,duration:1.15,ease:'power3.out',overwrite:'auto'});
    };
    if(!reduced){
      gsap.ticker.add(draw);
      canvas.addEventListener('pointermove',pointer);
      canvas.addEventListener('pointerleave',reset);
    }
    button?.addEventListener('click',toggle);
    document.addEventListener('portfolio:theme',syncColor);
    cleanups.push(() => {
      resize.disconnect();observer.disconnect();gsap.ticker.remove(draw);
      canvas.removeEventListener('pointermove',pointer);canvas.removeEventListener('pointerleave',reset);
      button?.removeEventListener('click',toggle);document.removeEventListener('portfolio:theme',syncColor);
      gsap.killTweensOf(state);
    });
  }
  dispose=() => {cleanups.forEach(fn => fn());context.revert();};
}
document.addEventListener('astro:page-load',onPage);
document.addEventListener('astro:before-swap',() => dispose?.());
motionPreference.addEventListener('change',onPage);
