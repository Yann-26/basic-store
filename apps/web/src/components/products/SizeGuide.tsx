import { useState } from 'react'
import clsx from 'clsx'
import Modal from '../ui/Modal'

const tables = {
  apparel: {
    label: 'Vêtements',
    head: ['Taille', 'Poitrine (cm)', 'Taille (cm)', 'Hanches (cm)'],
    rows: [
      ['XS', '80–84', '64–68', '86–90'],
      ['S', '85–90', '69–74', '91–96'],
      ['M', '91–97', '75–81', '97–102'],
      ['L', '98–104', '82–89', '103–108'],
      ['XL', '105–112', '90–97', '109–115'],
      ['XXL', '113–120', '98–106', '116–122'],
      ['3XL', '121–128', '107–115', '123–130'],
    ],
  },
  shoes: {
    label: 'Chaussures',
    head: ['EU', 'UK', 'US Homme', 'US Femme', 'Pied (cm)'],
    rows: [
      ['36', '3.5', '4.5', '6', '22.5'],
      ['37', '4', '5', '6.5', '23'],
      ['38', '5', '6', '7.5', '24'],
      ['39', '6', '7', '8.5', '24.5'],
      ['40', '6.5', '7.5', '9', '25'],
      ['41', '7', '8', '9.5', '26'],
      ['42', '8', '9', '10.5', '26.5'],
      ['43', '9', '10', '11.5', '27.5'],
      ['44', '9.5', '10.5', '12', '28'],
      ['45', '10.5', '11.5', '13', '29'],
      ['46', '11', '12', '13.5', '29.5'],
    ],
  },
  kids: {
    label: 'Enfants',
    head: ['Âge', 'Hauteur (cm)', 'Poitrine (cm)'],
    rows: [
      ['2A', '86–92', '52'],
      ['4A', '98–104', '56'],
      ['6A', '110–116', '60'],
      ['8A', '122–128', '64'],
      ['10A', '134–140', '68'],
      ['12A', '146–152', '74'],
      ['14A', '158–164', '80'],
    ],
  },
}

type Kind = keyof typeof tables

export default function SizeGuide({ open, onClose, initial = 'apparel' }: { open: boolean; onClose: () => void; initial?: Kind }) {
  const [tab, setTab] = useState<Kind>(initial)
  const table = tables[tab]
  return (
    <Modal open={open} onClose={onClose} title="Guide des tailles" size="lg">
      <div className="mb-6 flex gap-2">
        {(Object.keys(tables) as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={clsx('rounded-full px-4 py-2 text-xs uppercase tracking-widest', tab === k ? 'bg-gold text-primary-black' : 'border border-white/10 text-gray-300')}
          >
            {tables[k].label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              {table.head.map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <tr key={r[0]} className="border-t border-white/5">
                {r.map((c, i) => (
                  <td key={i} className={clsx('px-4 py-2.5', i === 0 ? 'font-semibold text-white' : 'text-gray-400')}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        Entre deux tailles ? Prenez la taille au-dessus, ou écrivez-nous sur WhatsApp : nous vous conseillons avec plaisir.
      </p>
    </Modal>
  )
}
