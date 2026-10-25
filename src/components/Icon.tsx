/** Spójny zestaw ikon liniowych (2 px), dopasowany wagą do tekstu – zamiast SF Symbols, których nie wolno osadzać w sieci. */
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  learn: 'M2 7l10-4 10 4-10 4L2 7zm4 2.6V15c0 1.7 2.7 3 6 3s6-1.3 6-3V9.6M22 7v6',
  book: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 1 4 18.5zM20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 0 1.5-1.5z',
  scale: 'M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zm14 0-3 7a3 3 0 0 0 6 0zM12 3l-2 2m2-2 2 2',
  case: 'M4 8h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zm5 0V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18',
  money: 'M3 6h18v12H3zM7 6a4 4 0 0 1-4 4m14-4a4 4 0 0 0 4 4M7 18a4 4 0 0 0-4-4m14 4a4 4 0 0 1 4-4M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-10v6m0-9.5v.5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8.4-1.6 1.6 1-1.8 3.2-1.8-.7a7 7 0 0 1-2.2 1.3L16 21h-3.6l-.3-1.8a7 7 0 0 1-2.4-1.3l-1.8.7L6 15.4l1.5-1.2a7 7 0 0 1 0-2.6L6 10.4l1.8-3.2 1.8.7a7 7 0 0 1 2.4-1.3L12.4 5H16l.2 1.6a7 7 0 0 1 2.2 1.3l1.8-.7L22 10.4l-1.6 1.2a7 7 0 0 1 0 1.8z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 3-4.4-4.4',
  chevron: 'M9 5l7 7-7 7',
  back: 'M15 5l-7 7 7 7',
  check: 'M5 12.5 10 17.5 19 7',
  x: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-14v5l3 2',
  flame: 'M12 21c4 0 7-2.8 7-6.8 0-3.2-2-5.2-3.4-6.6-.4 1.6-1.2 2.6-2.2 3.2.3-3-1.2-5.6-3.9-7.8-.2 3.3-1.7 5.2-3.2 7C5.2 11.3 5 12.6 5 14.2 5 18.2 8 21 12 21z',
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  refresh: 'M20 11a8 8 0 0 0-14.6-4.6M4 4v4h4M4 13a8 8 0 0 0 14.6 4.6M20 20v-4h-4',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm0-12v4l2.5 2.5M9 2h6',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4m8-4v4',
  car: 'M5 16V11l2-5h10l2 5v5M3 16h18v3h-3v-3M6 19H3M7 13h.01M17 13h.01',
  graduation: 'M2 8.5 12 4l10 4.5-10 4.5zM6 10.5V15c2 2 10 2 12 0v-4.5',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  share: 'M12 3v12M7 8l5-5 5 5M5 13v7h14v-7',
  shuffle: 'M3 7h4l10 10h4M3 17h4l3-3m4-4 3-3h4m-3-3 3 3-3 3m0 4 3 3-3 3',
  warning: 'M12 4 2.5 20h19zM12 10v4m0 3v.5',
  play: 'M7 4.5v15l12-7.5z',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, label, className }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
