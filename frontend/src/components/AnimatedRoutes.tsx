// Animated Routes Wrapper
// Provides page transition animations using Framer Motion

import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useReducedMotion } from '../hooks';

interface AnimatedRoutesProps {
  children: React.ReactNode;
}

export function AnimatedRoutes({ children }: AnimatedRoutesProps) {
  const location = useLocation();
  const reducedMotion = useReducedMotion();

  const transition = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: { duration: reducedMotion ? 0.01 : 0.2, ease: 'easeOut' },
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="animate"
        exit="exit"
        variants={transition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Page transition variants
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export const pageTransition = {
  duration: 0.2,
  ease: 'easeOut',
};

export const sidebarVariants = {
  open: { x: 0, opacity: 1 },
  closed: { x: -280, opacity: 0 },
};

export const sidebarTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};