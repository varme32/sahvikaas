export default function Modal({ isOpen, onClose, children, maxWidth = 'max-w-lg' }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className={`relative bg-white rounded-t-xl sm:rounded-xl shadow-2xl ${maxWidth} w-full sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-auto`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
