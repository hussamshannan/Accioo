import gsap from "gsap";

export function slideFromTop(target, overrides = {}) {
  return gsap.fromTo(
    target,
    { y: -20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.32, ease: "power3.out", ...overrides }
  );
}

export function slideFromBottom(target, overrides = {}) {
  return gsap.fromTo(
    target,
    { y: 20, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.32, ease: "power3.out", ...overrides }
  );
}

export function fadeUp(target, overrides = {}) {
  return gsap.fromTo(
    target,
    { y: 12, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.3, ease: "power2.out", ...overrides }
  );
}

export function staggerFadeUp(items, overrides = {}) {
  return gsap.fromTo(
    items,
    { y: 10, opacity: 0 },
    { y: 0, opacity: 1, duration: 0.28, ease: "power2.out", stagger: 0.05, ...overrides }
  );
}

export function scaleIn(target, overrides = {}) {
  return gsap.fromTo(
    target,
    { scale: 0.92, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.28, ease: "back.out(1.4)", ...overrides }
  );
}

export function scaleOut(target, onComplete) {
  return gsap.to(target, {
    scale: 0.92, opacity: 0, duration: 0.18, ease: "power2.in", onComplete,
  });
}

export function storyEntrance(target, overrides = {}) {
  return gsap.fromTo(
    target,
    { scale: 1.04, opacity: 0 },
    { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out", ...overrides }
  );
}
