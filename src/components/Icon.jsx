/* Monochrome line-icon set. Single color (currentColor), no emoji.
   Keeps the UI calm and consistent — one icon language, one hue. */
const PATHS = {
  power:      <><path d="M12 4v8"/><path d="M7.5 7a6.5 6.5 0 1 0 9 0"/></>,
  receipt:    <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h5"/></>,
  'calendar-plus': <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v3.5M15.5 3v3.5M12 12.5v4M10 14.5h4"/></>,
  phone:      <path d="M6 3h3.2l1.6 4-2.1 1.3a11 11 0 0 0 5 5L18 12l4 1.6V17a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4 5.2 2 2 0 0 1 6 3z"/>,
  home:       <><path d="M4 11l8-7 8 7"/><path d="M6.5 9.5V19h11V9.5"/></>,
  cash:       <><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/></>,
  calendar:   <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v3.5M15.5 3v3.5"/></>,
  list:       <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>,
  users:      <><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-3-4.9"/></>,
  pencil:     <><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></>,
  note:       <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9.5h8M8 13.5h5"/></>,
  check:      <path d="M5 12.5l4.5 4.5L19 7"/>,
  snowflake:  <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/>,
  x:          <path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>,
  chevron:    <path d="M10 6l6 6-6 6"/>,
  plus:       <path d="M12 5v14M5 12h14"/>,
  flame:      <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c1.5 0 1-3-1-5 2 0 3 1 3 1"/>,
  clipboard:  <><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z"/><path d="M9 11h6M9 15h4"/></>,
}

export default function Icon({ name, size = 20, className = '', style }) {
  return (
    <svg
      className={`ic ${className}`}
      width={size} height={size}
      viewBox="0 0 24 24" aria-hidden="true"
      style={style}
    >
      {PATHS[name] || null}
    </svg>
  )
}
