// War Room FAB — "Deep aperture" (14b). Final.
// Requires fab.css. Tailwind is not used: the effect needs conic-gradient
// and layered box-shadows that are clearer as plain CSS.
//
//   import './fab.css';
//   import Fab from './Fab';
//   <Fab open={sheetOpen} onClick={() => setSheetOpen(v => !v)} />

export default function Fab({ open = false, onClick, label = 'Add' }) {
  return (
    <button
      type="button"
      className="wr-fab"
      aria-label={label}
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="wr-fab__halo" />
      <span className="wr-fab__body">
        <span className="wr-fab__rim" />
        <span className="wr-fab__face">
          <span className="wr-fab__core" />
          <span className="wr-fab__bar wr-fab__bar--h" />
          <span className="wr-fab__bar wr-fab__bar--v" />
        </span>
      </span>
    </button>
  );
}
