'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  hentReoler, oppdaterSeksjon, oppdaterNivaa,
  lastOppBilde, slettBilde, reolVersteSkade,
  type ReolMedData, type Skade, type NivaaMedBilder, type SeksjonMedNivaer
} from '@/lib/api'

function SkadeKnapper({ valgt, onChange }: { valgt: Skade; onChange: (v: Skade) => void }) {
  const labels: Record<Skade, string> = { g: 'Gronn', y: 'Gul', r: 'Rod' }
  return (
    <div className="skade-grp">
      {(['g', 'y', 'r'] as Skade[]).map(v => (
        <div key={v}
          className={`sk sk-${v}${valgt === v ? ` sel-${v}` : ''}`}
          onClick={() => onChange(v)}>
          {labels[v]}
        </div>
      ))}
    </div>
  )
}

function skadeHint(v: Skade): { txt: string; col: string } {
  if (v === 'g') return { txt: 'Liten/ingen skade — ingen tiltak nodvendig', col: '#27500A' }
  if (v === 'y') return { txt: 'Ma byttes innen 4 uker — kan fortsatt brukes', col: '#633806' }
  return { txt: 'Alvorlig skade — steng reolen umiddelbart!', col: '#791F1F' }
}

export default function ReolKontroll({ params }: { params: { id: string; reolId: string } }) {
  const router = useRouter()
  const [reol, setReol] = useState<ReolMedData | null>(null)
  const [aktivSek, setAktivSek] = useState(0)
  const [laster, setLaster] = useState(true)
  const [feil, setFeil] = useState('')
  const [lasterFoto, setLasterFoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const fotoNivaaRef = useRef<NivaaMedBilder | null>(null)

  useEffect(() => {
    hentReoler(params.id)
      .then(reoler => {
        const funnet = reoler.find(r => r.id === params.reolId)
        if (funnet) setReol(funnet)
        else setFeil('Reol ikke funnet')
      })
      .catch(err => setFeil(err.message))
      .finally(() => setLaster(false))
  }, [])

  function oppdaterState(sekId: string, nivId: string | null, oppdatering: any) {
    setReol(prev => !prev ? prev : {
      ...prev,
      seksjoner: prev.seksjoner.map(s =>
        s.id !== sekId ? s : !nivId
          ? { ...s, ...oppdatering }
          : { ...s, nivaer: s.nivaer.map(n => n.id === nivId ? { ...n, ...oppdatering } : n) }
      )
    })
  }

  async function endreSekSkade(sek: SeksjonMedNivaer, skade: Skade) {
    oppdaterState(sek.id, null, { skade })
    try { await oppdaterSeksjon(sek.id, { skade }) }
    catch (err: any) { setFeil(err.message) }
  }

  async function endreNivaaSkade(sek: SeksjonMedNivaer, niv: NivaaMedBilder, skade: Skade) {
    oppdaterState(sek.id, niv.id, { skade })
    try { await oppdaterNivaa(niv.id, { skade }) }
    catch (err: any) { setFeil(err.message) }
  }

  async function endreKommentar(sek: SeksjonMedNivaer, niv: NivaaMedBilder, kommentar: string) {
    try { await oppdaterNivaa(niv.id, { kommentar }) }
    catch (err: any) { setFeil(err.message) }
  }

  function triggFoto(niv: NivaaMedBilder) {
    fotoNivaaRef.current = niv
    fileRef.current?.click()
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0]
    const niv = fotoNivaaRef.current
    if (!fil || !niv) return
    setLasterFoto(niv.id)
    try {
      const bilde = await lastOppBilde(niv.id, fil)
      setReol(prev => !prev ? prev : {
        ...prev,
        seksjoner: prev.seksjoner.map(s => ({
          ...s,
          nivaer: s.nivaer.map(n => n.id === niv.id ? { ...n, bilder: [...n.bilder, bilde] } : n)
        }))
      })
    } catch (err: any) {
      setFeil(`Bildefeil: ${err.message}`)
    } finally {
      setLasterFoto(null)
      e.target.value = ''
    }
  }

  async function handleSlettBilde(sek: SeksjonMedNivaer, niv: NivaaMedBilder, bildeId: string) {
    const bilde = niv.bilder.find(b => b.id === bildeId)
    if (!bilde) return
    try {
      await slettBilde(bilde)
      oppdaterState(sek.id, niv.id, { bilder: niv.bilder.filter(b => b.id !== bildeId) })
    } catch (err: any) { setFeil(err.message) }
  }

  if (laster) return <div className="app"><div className="loading">Laster...</div></div>
  if (!reol) return <div className="app"><div className="error-box" style={{ margin: 16 }}>{feil || 'Ikke funnet'}</div></div>

  const sek = reol.seksjoner[aktivSek]
  if (!sek) return <div className="app"><div className="loading">Seksjon ikke funnet</div></div>

  const hint = skadeHint(sek.skade)
  const status = reolVersteSkade(reol)

  return (
    <div className="app">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.push(`/inspeksjon/${params.id}`)}>Tilbake</button>
        <h1>{reol.reolnummer} — {reol.reoltype}</h1>
        <span className={`badge ${status === 'g' ? 'bg' : status === 'y' ? 'by' : 'br'}`}>
          {status === 'g' ? 'OK' : status === 'y' ? 'Gul' : 'Rod'}
        </span>
      </div>

      <div className="sek-nav">
        <button disabled={aktivSek === 0}
          onClick={() => { setAktivSek(a => a - 1); window.scrollTo(0, 0) }}>
          Forrige
        </button>
        <span className="sek-ind">Seksjon {aktivSek + 1} av {reol.antall_seksjoner}</span>
        <button disabled={aktivSek === reol.antall_seksjoner - 1}
          onClick={() => { setAktivSek(a => a + 1); window.scrollTo(0, 0) }}>
          Neste
        </button>
      </div>

      <div className="scroll">
        {feil && <div className="error-box">{feil}</div>}

        <div className="sec-label">Skade pa seksjon (stender / bjelke)</div>
        <SkadeKnapper valgt={sek.skade} onChange={v => endreSekSkade(sek, v)} />
        <div style={{ fontSize: 12, color: hint.col, marginBottom: 16 }}>{hint.txt}</div>

        <div className="sec-label">Hyllenivaer</div>
        {sek.nivaer.map((niv, ni) => (
          <div key={niv.id} className="nivaa-block">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Nivaa {ni + 1}{ni === 0 ? ' (gulv)' : ''}
            </div>
            <SkadeKnapper valgt={niv.skade} onChange={v => endreNivaaSkade(sek, niv, v)} />

            {niv.skade !== 'g' && (
              <textarea
                style={{ width: '100%', fontSize: 13, padding: '8px 10px', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 8, background: '#fff', color: '#1a1a1a', fontFamily: 'inherit', resize: 'vertical', marginTop: 6 }}
                placeholder="Beskriv skaden (valgfritt)..."
                defaultValue={niv.kommentar}
                rows={2}
                onBlur={e => endreKommentar(sek, niv, e.target.value)}
              />
            )}

            <div className="foto-btn" onClick={() => triggFoto(niv)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span>
                {lasterFoto === niv.id ? 'Laster opp...' : `Ta bilde${niv.bilder.length > 0 ? ` (${niv.bilder.length})` : ''}`}
              </span>
            </div>

            {niv.bilder.length > 0 && (
              <div className="foto-preview">
                {niv.bilder.map(b => (
                  <div key={b.id} className="foto-thumb">
                    <img src={b.data} alt="Skadebilde" />
                    <div className="foto-del" onClick={() => handleSlettBilde(sek, niv, b.id)}>x</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <button className="btn btn-p" onClick={() => router.push(`/inspeksjon/${params.id}`)}>
          Lagre og ga til oversikt
        </button>
        {aktivSek < reol.antall_seksjoner - 1 && (
          <button className="btn btn-s" style={{ marginTop: 8 }}
            onClick={() => { setAktivSek(a => a + 1); window.scrollTo(0, 0) }}>
            Neste seksjon
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleFoto} />
    </div>
  )
}
