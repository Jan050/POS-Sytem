import { useState } from 'react'
import Modal from './ui/Modal'

export default function HoldLabelModal({ isOpen, onClose, onConfirm, itemCount }) {
  const [label, setLabel] = useState('')

  const handleConfirm = () => {
    onConfirm(label.trim())
    setLabel('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Hold Order" size="sm">
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 text-sm">
          <p className="text-amber-300 font-medium">
            ⏸️ Parking {itemCount} item{itemCount !== 1 ? 's' : ''} for later
          </p>
          <p className="text-amber-400/70 text-xs mt-0.5">
            Your cart will be saved and you can resume it anytime.
          </p>
        </div>

        <div>
          <label className="text-xs text-slate-400 block mb-1.5">
            Label <span className="text-slate-600">(optional — e.g. customer name)</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            placeholder="e.g. Aling Nena, Table 2…"
            className="input px-3 py-2.5"
            maxLength={60}
            autoFocus
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-secondary flex-1 py-2.5">Cancel</button>
          <button onClick={handleConfirm} className="btn-primary flex-1 py-2.5 font-semibold">
            ⏸️ Hold Cart
          </button>
        </div>
      </div>
    </Modal>
  )
}