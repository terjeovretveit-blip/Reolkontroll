'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hentEpostInnstillinger, lagreEpostInnstillinger } from '@/lib/api'

const LEVERANDORER = [
  { navn: 'Gmail', host: 'smtp.gmail.com', port: 587, info: 'Bruk App-passord (ikke vanlig passord). Aktiver 2-trinns bekreftelse i Google-konto, ga til Sikkerhet > App-passord og generer et nytt.' },
  { navn: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, info: 'Bruk ditt vanlige Outlook-passord, eller et App-passord om MFA er aktivert pa kontoen.' },
  { navn: 'Yahoo Mail', host: 'smtp.mail.yahoo.com', port: 587, info: 'Generer et App-passord fra Yahoo-kontoen under Sikkerhet > App-passord.' },
  { navn: 'Annen / egendefinert', host: '', port: 587, info: 'Fyll inn SMTP-server og port fra din e-postleverandor.' },
]

export default function Innstillinger() {
  const router = useRouter()
  const [valgt, setValgt] = useState(0)
  const [form, setForm] = useState({ host: '', port: '587', bruker: '', passord: '', fra: '' })
  const [laster, setLaster] = useState(true)
  const [lagrer, setLagrer] = useState(false)
  const [melding, setMelding] = useState('')
  const [feil, setFeil] = useState('')
  const [harPassord, setHarPassord] = useState(false)

  useEffect(() => {
    hentEpostInnstillinger()
      .then((inn: any) => {
        if (inn) {
          setForm({ host: inn.host, port: String(inn.port), bruker: inn.bruker, passord: '', fra: inn.fra || '' })
          setHarPassord(inn.harPassord)
          const idx = LEVERANDORER.findIndex(l => l.host === inn.host)
          setValgt(idx >= 0 ? idx : 3)
        }
      })
      .catch(() => {})
      .finally(() => setLaster(false))
  }, [])

  function velgLeverandor(idx: number) {
    setValgt(idx)
    setForm(f => ({ ...f, host: LEVERANDORER[idx].host, port: String(LEVERANDORER[idx].port) }))
  }

  async function lagre(e: React.FormEvent) {
    e.preventDefault()
    if (!form.passord && !harPassord) { setFeil('Passord er pakrevd'); return }
    setFeil(''); setMelding(''); setLagrer(true)
    try {
      await lagreEpostInnstillinger({
        host: form.host,
        port: parseInt(form.port),
        bruker: form.bruker,
        passord: form.passord || undefined,
        fra: form.fra || form.bruker,
      })
      setMelding('Innstillinger lagret!')
      setHarPassord(true)
      setForm(f => ({ ...f, passord: '' }))
    } catch (err: any) {
      setFeil(err.message)
    } finally {
      setLagrer(false)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.push('/')}>Tilbake</button>
        <h1>E-postinnstillinger</h1>
      </div>
      <div className="scroll">
        {laster ? <div className="loading">Laster...</div> : (
          <>
            <div className="sec-label">Velg e-postleverandor</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {LEVERANDORER.map((l, i) => (
                <div key={i} onClick={() => velgLeverandor(i)} style={{
                  padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  border: valgt === i ? '2px solid #1D9E75' : '0.5px solid rgba(0,0,0,0.15)',
                  background: valgt === i ? '#EAF3DE' : '#fff',
                  color: valgt === i ? '#27500A' : '#1a1a1a',
                }}>
                  {l.navn}
                </div>
              ))}
            </div>

            <div style={{ background: '#E6F1FB', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#0C447C', marginBottom: 16 }}>
              {LEVERANDORER[valgt].info}
            </div>

            {feil && <div className="error-box">{feil}</div>}
            {melding && <div className="suksess-box">{melding}</div>}

            <form onSubmit={lagre}>
              {valgt === 3 && (
                <div className="fg">
                  <label>SMTP-server (host)</label>
                  <input value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} placeholder="smtp.eksempel.no" />
                </div>
              )}
              <div className="fg">
                <label>SMTP-port</label>
                <input value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} type="number" />
              </div>
              <div className="fg">
                <label>E-postadresse (brukernavn)</label>
                <input value={form.bruker} onChange={e => setForm(f => ({ ...f, bruker: e.target.value }))} placeholder="din@epost.no" type="email" />
              </div>
              <div className="fg">
                <label>{harPassord ? 'Nytt passord (la staa tomt for aa beholde gjeldende)' : 'Passord / App-passord'}</label>
                <input value={form.passord} onChange={e => setForm(f => ({ ...f, passord: e.target.value }))}
                  type="password" placeholder={harPassord ? '(uendret)' : 'Skriv inn passord'} />
              </div>
              <div className="fg">
                <label>Avsenderadresse (valgfri — standard er e-postadressen over)</label>
                <input value={form.fra} onChange={e => setForm(f => ({ ...f, fra: e.target.value }))} placeholder="din@epost.no" type="email" />
              </div>
              <button className="btn btn-p" type="submit" disabled={lagrer}>
                {lagrer ? 'Lagrer...' : 'Lagre innstillinger'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
