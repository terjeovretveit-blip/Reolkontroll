'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hentInspeksjoner, slettInspeksjon, type Inspeksjon } from '@/lib/api'

export default function Hjem() {
  const router = useRouter()
  const [inspeksjoner, setInspeksjoner] = useState<Inspeksjon[]>([])
  const [laster, setLaster] = useState(true)
  const [sletterId, setSletterId] = useState<string | null>(null)

  useEffect(() => {
    hentInspeksjoner()
      .then(setInspeksjoner)
      .finally(() => setLaster(false))
  }, [])

  async function bekreftSlett(id: string) {
    setSletterId(null)
    await slettInspeksjon(id)
    setInspeksjoner(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div className="app">
      <div className="topbar">
        <h1>Reolkontroll</h1>
        <button
          onClick={() => router.push('/innstillinger')}
          style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.18)', background: '#fff', cursor: 'pointer', fontSize: 13, color: '#444', fontFamily: 'inherit' }}>
          E-post
        </button>
      </div>

      <div className="scroll">
        <div style={{ textAlign: 'center', padding: '20px 0 16px' }}>
          <div style={{ width: 52, height: 52, background: '#EAF3DE', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
            </svg>
          </div>
          <div style={{ fontSize: 19, fontWeight: 600 }}>Reolkontroll</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 3 }}>Internverktoy for inspeksjon</div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
            <div className="sec-label" style={{ marginBottom: 10 }}>Inspeksjoner</div>
            {laster && <div style={{ fontSize: 14, color: '#888', padding: '8px 0' }}>Laster...</div>}
            {!laster && inspeksjoner.length === 0 && (
              <div style={{ fontSize: 14, color: '#888', padding: '8px 0' }}>Ingen inspeksjoner enna — trykk "Ny inspeksjon" for aa starte</div>
            )}
            {inspeksjoner.map(ins => (
              <div key={ins.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div className="reol-row" style={{ flex: 1 }} onClick={() => router.push(`/inspeksjon/${ins.id}`)}>
                    <div>
                      <h3>{ins.kunde}</h3>
                      <p>{ins.adresse} · {ins.dato} · {ins.inspektor}</p>
                    </div>
                    <span className="badge by">Aktiv</span>
                  </div>
                  <button
                    onClick={() => setSletterId(ins.id)}
                    style={{ padding: '0 14px', borderRadius: 8, border: '0.5px solid #F7C1C1', background: '#FCEBEB', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#791F1F' }}>
                    Slett
                  </button>
                </div>
                {sletterId === ins.id && (
                  <div className="bekreft-boks" style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 14, color: '#791F1F', marginBottom: 10, fontWeight: 600 }}>
                      Slette inspeksjon for {ins.kunde}? All data slettes permanent.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => bekreftSlett(ins.id)}
                        style={{ flex: 1, padding: 9, borderRadius: 8, background: '#A32D2D', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                        Ja, slett
                      </button>
                      <button onClick={() => setSletterId(null)}
                        style={{ flex: 1, padding: 9, borderRadius: 8, background: '#fff', color: '#1a1a1a', border: '0.5px solid rgba(0,0,0,0.18)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                        Avbryt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ padding: '12px 14px' }}>
            <button className="btn btn-p" style={{ marginTop: 0 }} onClick={() => router.push('/ny-inspeksjon')}>
              + Ny inspeksjon
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
