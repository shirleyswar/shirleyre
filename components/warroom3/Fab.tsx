// War Room FAB — "Deep aperture" (14b). Final.
// Verbatim from package Fab.jsx — ported to TSX, CSS injected via globals.css.
// README rules binding: no outer drop-shadow/box-shadow, never lighten face,
// glyph stays pure white, one FAB per screen, desktop gets none.

export default function Fab({
  open = false,
  onClick,
  label = 'Add',
}: {
  open?: boolean
  onClick?: () => void
  label?: string
}) {
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
  )
}
