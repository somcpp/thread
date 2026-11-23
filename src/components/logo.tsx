export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#B4441F" />
      <path d="M7 11c6 0 6 10 12 10s6-10 6-10" stroke="#F4D9A6" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M7 21c6 0 6-10 12-10" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
