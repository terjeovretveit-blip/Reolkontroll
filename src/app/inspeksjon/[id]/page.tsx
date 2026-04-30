'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  hentInspeksjoner, hentReoler, reolVersteSkade,
  oppdaterReol, slettReol,
  type Inspeksjon, type ReolMedData, type Skade
} from '@/lib/api'

function StatusBadge({ skade }: { skade: Skade }) {
  if (skade === 'g') return <span className="badge bg">Godkjent</span>
  if (skade === 'y') return <span className="badge by">Gul skade</span>
  return <span className="badge br">Rod — steng!</span>
}

export default function InspeksjonSide({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [ins, setIns] = useState<Inspeksjon | null>(null)
  const [reoler, setReoler] = useState<ReolMedData[]>([])
  const [laster, setLaster] = useState(true)
  const [redigerReol, setRedigerReol] = useState<ReolMedData | null>(null)
  const [sletterId, setSletterId] = useState<string | null>(null)
  const [feil, setFeil] = useState('')

  async function last() {
    const [alle, rl] = await Promise.all([hentInspeksjoner(), hentReoler(params.id)])
    setIns(alle.find(i => i.id === params.id) || null)
    setReoler(rl)
    setLaster(false)
  }
  useEffect(() => { last() }, [])

  async function bekreftSlett(id: string) {
    setSletterId(null)
    try {
      await slettReol(id)
      setReoler(prev => prev.filter(r => r.id !== id))
    } catch (err: any) { setFeil(err.message) }
  }

  async function lagreRediger(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!redigerReol) return
    const fd = new FormData(e.currentTarget)
    try {
      await oppdaterReol(redigerReol.id, {
        reolnummer: (fd.get('nr') as string).trim(),
        reoltype: fd.get('type') as string,
        produsent: (fd.get('prod') as string).trim(),
      })
      setRedigerReol(null)
      await last()
    } catch (err: any) { setFeil(err.message) }
  }

  const g = reoler.filter(r => reolVersteSkade(r) === 'g').length
  const y = reoler.filter(r => reolVersteSkade(r) === 'y').length
  const r = reoler.filter(r => reolVersteSkade(r) === 'r').length

  return (
    <div className="app">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.push('/')}>Hjem</button>
        <h1>{ins?.kunde ?? '...'}</h1>
      </div>

      {ins && (
        <div style={{ padding: '10px 16px', background: '#e8e8e6', borderBottom: '0.5px solid rgba(0,0,0,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#666' }}>
            {ins.adresse} · {ins.dato} · Kontakt: {ins.kontakt} · Inspektor: {ins.inspektor}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge bb">{reoler.length} reoler</span>
            {g > 0 && <span className="badge bg">{g} godkjent</span>}
            {y > 0 && <span className="badge by">{y} gul skade</span>}
            {r > 0 && <span className="badge br">{r} rod</span>}
          </div>
        </div>
      )}

      <div className="scroll">
        {feil && <div className="error-box">{feil}</div>}
        {laster && <div className="loading">Laster reoler...</div>}

        {!laster && (
          <>
            <div className="sec-label">Registrerte reoler</div>
            {reoler.length === 0 && (
              <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>
                Ingen reoler registrert enna — trykk "+ Legg til reol"
              </div>
            )}

            {reoler.map(rl => (
              <div key={rl.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                  <div className="reol-row" style={{ flex: 1 }}
                    onClick={() => router.push(`/inspeksjon/${params.id}/reol/${rl.id}`)}>
                    <div>
                      <h3>{rl.reolnummer} — {rl.reoltype}</h3>
                      <p>{rl.produsent} · {rl.antall_seksjoner} seksjoner · {rl.antall_nivaer} nivaaer</p>
                    </div>
                    <StatusBadge skade={reolVersteSkade(rl)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => setRedigerReol(rl)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid rgba(0,0,0,0.18)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#185FA5' }}>
                      Rediger
                    </button>
                    <button
                      onClick={() => setSletterId(rl.id)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid #F7C1C1', background: '#FCEBEB', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#791F1F' }}>
                      Slett
                    </button>
                  </div>
                </div>

                {sletterId === rl.id && (
                  <div className="bekreft-boks" style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 14, color: '#791F1F', marginBottom: 10, fontWeight: 600 }}>
                      Slette {rl.reolnummer}? All data inkludert bilder slettes.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => bekreftSlett(rl.id)}
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

            <button className="btn btn-s" style={{ marginTop: 4 }}
              onClick={() => router.push(`/inspeksjon/${params.id}/ny-reol`)}>
              + Legg til reol
            </button>
            <button className="btn btn-p" style={{ marginTop: 8 }}
              onClick={() => router.push(`/inspeksjon/${params.id}/rapport`)}>
              Generer rapport
            </button>
          </>
        )}
      </div>

      {redigerReol && (
        <div className="modal-overlay">
          <div className="modal-boks">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Rediger {redigerReol.reolnummer}</div>
            <form onSubmit={lagreRediger}>
              <div className="fg"><label>Reolnummer / navn</label>
                <input name="nr" defaultValue={redigerReol.reolnummer} /></div>
              <div className="fg"><label>Reoltype</label>
                <select name="type" defaultValue={redigerReol.reoltype}>
                  <option>Pallreol</option>
                  <option>Grenreol</option>
                  <option>Smavarereol</option>
                </select>
              </div>
              <div className="fg"><label>Produsent</label>
                <input name="prod" defaultValue={redigerReol.produsent} /></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="submit" className="btn btn-p" style={{ margin: 0 }}>Lagre</button>
                <button type="button" className="btn btn-s" style={{ margin: 0 }}
                  onClick={() => setRedigerReol(null)}>Avbryt</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
