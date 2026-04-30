'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { opprettReol, opprettReolGodkjent } from '@/lib/api'

export default function NyReol({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [laster, setLaster] = useState(false)
  const [feil, setFeil] = useState('')

  function lesSkjema(form: HTMLFormElement) {
    const fd = new FormData(form)
    return {
      inspeksjon_id: params.id,
      reolnummer: (fd.get('nr') as string).trim() || 'Reol',
      reoltype: fd.get('type') as string,
      produsent: (fd.get('prod') as string).trim(),
      antall_seksjoner: parseInt(fd.get('ant') as string) || 3,
      antall_nivaer: parseInt(fd.get('niv') as string) || 3,
      godkjent: false,
    }
  }

  async function startKontroll(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFeil(''); setLaster(true)
    try {
      const reol = await opprettReol(lesSkjema(e.currentTarget))
      router.push(`/inspeksjon/${params.id}/reol/${reol.id}`)
    } catch (err: any) {
      setFeil(err.message)
      setLaster(false)
    }
  }

  async function markerGodkjent() {
    const form = document.getElementById('reolform') as HTMLFormElement
    setFeil(''); setLaster(true)
    try {
      await opprettReolGodkjent(lesSkjema(form))
      router.push(`/inspeksjon/${params.id}`)
    } catch (err: any) {
      setFeil(err.message)
      setLaster(false)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.back()}>Tilbake</button>
        <h1>Ny reol</h1>
      </div>
      <div className="scroll">
        {feil && <div className="error-box">{feil}</div>}
        <form id="reolform" onSubmit={startKontroll}>
          <div className="fg"><label>Reolnummer / navn</label>
            <input name="nr" placeholder="f.eks. Reol 4" /></div>
          <div className="fg"><label>Reoltype</label>
            <select name="type">
              <option>Pallreol</option>
              <option>Grenreol</option>
              <option>Smavarereol</option>
            </select>
          </div>
          <div className="fg"><label>Produsent</label>
            <input name="prod" placeholder="f.eks. Dexion, Nedcon, SSI Schafer" /></div>
          <div className="fg"><label>Antall seksjoner</label>
            <input name="ant" type="number" min="1" max="50" defaultValue="4" /></div>
          <div className="fg"><label>Antall hyllenivaer per seksjon</label>
            <input name="niv" type="number" min="1" max="15" defaultValue="3" /></div>
          <button className="btn btn-p" type="submit" disabled={laster}>
            {laster ? 'Oppretter...' : 'Start seksjonskontroll'}
          </button>
          <button type="button" className="btn btn-ok" disabled={laster} onClick={markerGodkjent}>
            Merk hele reolen som godkjent (ingen skader)
          </button>
        </form>
      </div>
    </div>
  )
}
