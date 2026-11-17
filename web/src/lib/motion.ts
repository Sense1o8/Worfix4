/**
 * One motion language for the whole product (Emil Kowalski-style restraint):
 * - strong ease-out, UI feedback 140–220ms, page reveals ≤ 300ms
 * - only transform + opacity
 * - nothing animates from scale(0); presence changes start at ~0.96/opacity 0
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user"> and the CSS media query.
 */
export const EASE = [0.23, 1, 0.32, 1] as const;

export const DUR = { press: 0.14, ui: 0.2, page: 0.28 } as const;

export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.page, ease: EASE } },
};

export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.page, ease: EASE } },
};

/** Stagger only small groups (≤ 8 items) with a short delay. */
export const stagger = (i: number, max = 8) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: DUR.page, ease: EASE, delay: Math.min(i, max) * 0.04 } },
});

export const popIn = {
  initial: { opacity: 0, scale: 0.96, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: DUR.ui, ease: EASE } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: DUR.press, ease: EASE } },
};

export const press = { scale: 0.97, transition: { duration: DUR.press, ease: EASE } };
export const lift = { y: -2, transition: { duration: DUR.ui, ease: EASE } };
