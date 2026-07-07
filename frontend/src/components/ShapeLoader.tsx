'use client';

// Natural footprint of the three shapes + their 0 8px margins, before scaling.
const BASE_WIDTH = 232;
const BASE_HEIGHT = 44;

interface ShapeLoaderProps {
  /** Uniform scale applied to the whole loader so it can drop into compact spaces
   * without recalculating the shape/dot pixel math below. The outer wrapper is
   * sized to the scaled footprint so it doesn't reserve its full unscaled width
   * in flex/inline layouts (a plain CSS `transform: scale()` would). */
  scale?: number;
}

export default function ShapeLoader({ scale = 1 }: ShapeLoaderProps) {
  return (
    <div style={{ width: BASE_WIDTH * scale, height: BASE_HEIGHT * scale, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ width: BASE_WIDTH, height: BASE_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        <div className="shapeLoaderRow">
          <div className="loader">
            <svg viewBox="0 0 80 80">
              <circle r={32} cy={40} cx={40} />
            </svg>
          </div>
          <div className="loader triangle">
            <svg viewBox="0 0 86 80">
              <polygon points="43 8 79 72 7 72" />
            </svg>
          </div>
          <div className="loader">
            <svg viewBox="0 0 80 80">
              <rect height={64} width={64} y={8} x={8} />
            </svg>
          </div>
        </div>
        <style jsx>{`
        .shapeLoaderRow {
          display: flex;
          align-items: center;
        }

        .loader {
          --path: #2f3545;
          --dot: #5628ee;
          --duration: 3s;
          width: 44px;
          height: 44px;
          position: relative;
          display: inline-block;
          margin: 0 8px;
        }

        .loader:before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          position: absolute;
          display: block;
          background: var(--dot);
          top: 37px;
          left: 19px;
          transform: translate(-18px, -18px);
          animation: dotRect var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .loader svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        .loader svg rect,
        .loader svg polygon,
        .loader svg circle {
          fill: none;
          stroke: var(--path);
          stroke-width: 10px;
          stroke-linejoin: round;
          stroke-linecap: round;
        }

        .loader svg polygon {
          stroke-dasharray: 145 76 145 76;
          stroke-dashoffset: 0;
          animation: pathTriangle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .loader svg rect {
          stroke-dasharray: 192 64 192 64;
          stroke-dashoffset: 0;
          animation: pathRect var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .loader svg circle {
          stroke-dasharray: 150 50 150 50;
          stroke-dashoffset: 75;
          animation: pathCircle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        .loader.triangle {
          width: 48px;
        }

        .loader.triangle:before {
          left: 21px;
          transform: translate(-10px, -18px);
          animation: dotTriangle var(--duration) cubic-bezier(0.785, 0.135, 0.15, 0.86) infinite;
        }

        @keyframes pathTriangle {
          33% {
            stroke-dashoffset: 74;
          }
          66% {
            stroke-dashoffset: 147;
          }
          100% {
            stroke-dashoffset: 221;
          }
        }

        @keyframes dotTriangle {
          33% {
            transform: translate(0, 0);
          }
          66% {
            transform: translate(10px, -18px);
          }
          100% {
            transform: translate(-10px, -18px);
          }
        }

        @keyframes pathRect {
          25% {
            stroke-dashoffset: 64;
          }
          50% {
            stroke-dashoffset: 128;
          }
          75% {
            stroke-dashoffset: 192;
          }
          100% {
            stroke-dashoffset: 256;
          }
        }

        @keyframes dotRect {
          25% {
            transform: translate(0, 0);
          }
          50% {
            transform: translate(18px, -18px);
          }
          75% {
            transform: translate(0, -36px);
          }
          100% {
            transform: translate(-18px, -18px);
          }
        }

        @keyframes pathCircle {
          25% {
            stroke-dashoffset: 125;
          }
          50% {
            stroke-dashoffset: 175;
          }
          75% {
            stroke-dashoffset: 225;
          }
          100% {
            stroke-dashoffset: 275;
          }
        }
      `}</style>
      </div>
    </div>
  );
}
