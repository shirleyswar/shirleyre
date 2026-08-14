// War Room LAUNCH control — "Threshold". Standalone asset wrapper.
// Requires launch.css (same family as assets/fab/fab.css).
// Import: import Launch from '@/components/warroom3/Launch'
// Usage:  <Launch launched={false} onClick={() => {}} label="LAUNCH DEAL" />
//
// The markup is verbatim from the file header comment in assets/launch/launch.css.
// data-state="launched" cools the well to green (money-in) and holds the escaped dot frame.

export default function Launch({ launched = false, onClick, label = 'LAUNCH DEAL' }) {
  return (
    <button
      type="button"
      className="wr-launch"
      data-state={launched ? 'launched' : undefined}
      onClick={onClick}
      aria-label={label}
    >
      <span className="wr-launch__mark">
        <span className="wr-launch__halo"></span>
        <span className="wr-launch__body"></span>
        <span className="wr-launch__rim"></span>
        <span className="wr-launch__face"><span className="wr-launch__core"></span></span>
        <span className="wr-launch__ring"></span>
        <span className="wr-launch__orbit"><span className="wr-launch__dot"></span></span>
      </span>
      <span className="wr-launch__label">{label}</span>
    </button>
  );
}
