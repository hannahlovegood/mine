// Block wrappers. MorphBlock carries a shared layoutId so the same block can glide between
// the portal and the edition; PlainBlock is the static equivalent (overlays, reduced motion).
import type { ComponentType, ReactNode } from 'react';
import { motion } from 'motion/react';

export interface WrapProps {
  id: string;
  children: ReactNode;
  className?: string;
  attrs?: Record<string, string | undefined>;
  onHover?: (on: boolean) => void;
}
export type Wrap = ComponentType<WrapProps>;

const MORPH = { duration: 0.6, ease: [0.2, 0, 0, 1] as [number, number, number, number] };

export function MorphBlock({ id, children, className, attrs, onHover }: WrapProps) {
  return (
    <motion.div
      layoutId={id}
      layout="position"
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ layout: MORPH, opacity: { duration: 0.35 } }}
      onHoverStart={onHover ? () => onHover(true) : undefined}
      onHoverEnd={onHover ? () => onHover(false) : undefined}
      {...attrs}
    >
      {children}
    </motion.div>
  );
}

export function PlainBlock({ children, className, attrs, onHover }: WrapProps) {
  return (
    <div
      className={className}
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      {...attrs}
    >
      {children}
    </div>
  );
}
