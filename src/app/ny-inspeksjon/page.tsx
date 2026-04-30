'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { opprettInspeksjon } from '@/lib/api'

export default function NyInspeksjon() {
  const router = useRouter()
  const [feil, setFeil] = useState('')
  const [laster, setLaster] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const kunde = (fd.get('kunde') as string).trim()
    if (!kunde) { setFeil('Kundenavn er pakrevd'); return }
    setFeil(''); setLaster(true)
    try {
      const ins = await opprettInspeksjon({
        kunde,
        adresse: (fd.get('adresse') as string).trim(),
        kontakt: (fd.get('kontakt') as string).trim(),
        dato: fd.get('dato') as string,
        inspektor: (fd.get('inspektor') as string).trim(),
      })
      router.push(`/inspeksjon/${ins.id}`)
    } catch (err: any) {
      setFeil(err.message)
      setLaster(false)
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="back-btn" onClick={() => router.back()}>Tilbake</button>
        <h1>Ny inspeksjon</h1>
      </div>
      <div className="scroll">
        {feil && <div className="error-box">{feil}</div>}
        <form onSubmit={handleSubmit}>
          <div className="fg"><label>Kundenavn *</label><input name="kunde" placeholder="Firma AS" /></div>
          <div className="fg"><label>Adresse / lokasjon</label><input name="adresse" placeholder="Gate, by" /></div>
          <div className="fg"><label>Kontaktperson</label><input name="kontakt" placeholder="Navn" /></div>
          <div className="fg"><label>Dato</label><input name="dato" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
          <div className="fg"><label>Inspektor</label><input name="inspektor" placeholder="Ditt navn" /></div>
          <button className="btn btn-p" type="submit" disabled={laster}>
            {laster ? 'Oppretter...' : 'Start inspeksjon'}
          </button>
        </form>
      </div>
    </div>
  )
}
