import React from 'react';
import { ICONS } from './icons';

/** Decorative by default (aria-hidden); pass `label` when the icon is the only content of a control. */
export default function Icon({ name, size = 18, strokeWidth = 1.8, className = '', label }) {
  const shapes = ICONS[name];
  if (!shapes) return null;
  return (
    <svg
      className={`ui-icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
      focusable="false"
    >
      {shapes.map((shape, i) => {
        if (typeof shape === 'string') return <path key={i} d={shape} />;
        if (shape.circle) return <circle key={i} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />;
        const [x, y, width, height, rx] = shape.rect;
        return <rect key={i} x={x} y={y} width={width} height={height} rx={rx} />;
      })}
    </svg>
  );
}
