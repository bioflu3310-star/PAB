export default function Modal({ children, onClose, wide }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-box${wide ? ' modal-lg' : ''}`} onClick={e => e.stopPropagation()}
        style={wide ? { maxWidth: 680, width: '95%' } : {}}>
        {children}
      </div>
    </div>
  )
}
