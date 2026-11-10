import { useId } from 'react';

import { cn } from '@/lib/tailwind/utils';

const PALETTE = {
  default: {
    accent: '#22d3ee',
    accentDark: '#0e7490',
    band: '#f87171',
    glow: '#22d3ee',
  },
  error: {
    accent: '#f87171',
    accentDark: '#991b1b',
    band: '#f97316',
    glow: '#ef4444',
  },
} as const;

// Flame paths share the same commands so SMIL can morph between them
const FLAME_OUTER = [
  'M84 142Q78 178 100 214Q122 178 116 142Z',
  'M84 142Q82 168 100 196Q118 168 116 142Z',
];
const FLAME_INNER = [
  'M91 142Q88 166 100 190Q112 166 109 142Z',
  'M91 142Q91 158 100 176Q109 158 109 142Z',
];

/**
 * Login mascot: a small rocket with a round window.
 * In the error state the engine cuts out (smoke instead of flame) and it turns red.
 */
export const MascotVector = (props: {
  state: 'default' | 'error';
  className?: string;
}) => {
  // State in the id so gradient defs never collide between the two palettes
  const id = `${useId()}-${props.state}`;
  const isError = props.state === 'error';
  const c = PALETTE[props.state];

  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden
      className={cn('overflow-visible', props.className)}
    >
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0%" stopColor={c.glow} stopOpacity="0.45" />
          <stop offset="100%" stopColor={c.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id={`${id}-accent`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={c.accent} />
          <stop offset="100%" stopColor={c.accentDark} />
        </linearGradient>
        <radialGradient id={`${id}-window`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#0b1530" />
        </radialGradient>
        <linearGradient id={`${id}-flame`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Halo */}
      <circle cx="100" cy="100" r="90" fill={`url(#${id}-glow)`} />

      <g transform="translate(-10 4) rotate(35 100 110)">
        {/* Exhaust */}
        {isError ? (
          <g fill="#94a3b8" opacity="0.7">
            <circle cx="96" cy="152" r="8" />
            <circle cx="106" cy="164" r="10" opacity="0.7" />
            <circle cx="94" cy="178" r="7" opacity="0.5" />
          </g>
        ) : (
          <g key={props.state}>
            <path
              d={FLAME_OUTER[0]}
              fill={`url(#${id}-flame)`}
              filter={`url(#${id}-blur)`}
            >
              <animate
                attributeName="d"
                values={`${FLAME_OUTER[0]};${FLAME_OUTER[1]};${FLAME_OUTER[0]}`}
                dur="0.35s"
                repeatCount="indefinite"
              />
            </path>
            <path d={FLAME_INNER[0]} fill="#fef9c3">
              <animate
                attributeName="d"
                values={`${FLAME_INNER[0]};${FLAME_INNER[1]};${FLAME_INNER[0]}`}
                dur="0.25s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        )}

        {/* Fins */}
        <path d="M70 100L44 134L48 150L70 132Z" fill={`url(#${id}-accent)`} />
        <path d="M130 100L156 134L152 150L130 132Z" fill={c.accentDark} />

        {/* Nozzle */}
        <path d="M80 128H120L114 142H86Z" fill="#475569" />

        {/* Body */}
        <path
          d="M100 22C128 40 136 80 132 128H68C64 80 72 40 100 22Z"
          fill={`url(#${id}-body)`}
        />
        {/* Nose cone */}
        <path
          d="M100 22C116 32 125 46 129 62H71C75 46 84 32 100 22Z"
          fill={`url(#${id}-accent)`}
        />
        {/* Band */}
        <rect x="67" y="116" width="66" height="12" rx="2" fill={c.band} />

        {/* Window */}
        <circle cx="100" cy="88" r="20" fill="#cbd5e1" />
        <circle cx="100" cy="88" r="16" fill={`url(#${id}-window)`} />
        <ellipse
          cx="93"
          cy="80"
          rx="5"
          ry="3"
          fill="#fff"
          opacity="0.35"
          transform="rotate(-30 93 80)"
        />
      </g>
    </svg>
  );
};
