'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  hentInspeksjoner, hentReoler, reolVersteSkade, sendEpostRapport,
  type Inspeksjon, type ReolMedData, type Skade
} from '@/lib/api'

const fc = (sk: Skade) => sk === 'g' ? '#1D9E75' : sk === 'y' ? '#BA7517' : '#A32D2D'
const fbg = (sk: Skade) => sk === 'g' ? '#f5fbf7' : sk === 'y' ? '#fdf8f0' : '#fdf4f4'
const ft = (sk: Skade) => sk === 'g' ? 'Godkjent' : sk === 'y' ? 'Gul — tiltak innen 4 uker' : 'ROD — Steng umiddelbart!'
const nt = (sk: Skade) => sk === 'g' ? 'OK' : sk === 'y' ? 'Bytt innen 4 uker' : 'ALVORLIG — steng!'

export default function RapportSide({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [ins, setIns] = useState<Inspeksjon | null>(null)
  const [reoler, setReoler] = useState<ReolMedData[]>([])
  const [laster, setLaster] = useState(true)
  const [visEpost, setVisEpost] = useState(false)
  const [mottaker, setMottaker] = useState('')
  const [senderEpost, setSenderEpost] = useState(false)
  const [epostSendt, setEpostSendt] = useState(false)
  const [epostFeil, setEpostFeil] = useState('')

  useEffect(() => {
    Promise.all([hentInspeksjoner(), hentReoler(params.id)])
      .then(([alle, rl]) => {
        setIns(alle.find(i => i.id === params.id) || null)
        setReoler(rl)
      })
      .finally(() => setLaster(false))
  }, [])

  async function sendRapport() {
    if (!mottaker.trim() || !ins) return
    setSenderEpost(true); setEpostFeil('')
    try {
      await sendEpostRapport(ins, reoler, mottaker.trim())
      setEpostSendt(true); setVisEpost(false)
    } catch (err: any) {
      setEpostFeil(err.message)
    } finally {
      setSenderEpost(false)
    }
  }

  const g = reoler.filter(r => reolVersteSkade(r) === 'g').length
  const y = reoler.filter(r => reolVersteSkade(r) === 'y').length
  const r = reoler.filter(r => reolVersteSkade(r) === 'r').length

  const alleTiltak = reoler.flatMap(rl =>
    rl.seksjoner.flatMap(sek =>
      sek.nivaer.filter(n => n.skade !== 'g').map(n => ({
        reol: rl.reolnummer, sek: sek.seksjon_index + 1,
        niv: n.nivaa_index + 1, skade: n.skade, kommentar: n.kommentar
      }))
    )
  )

  if (laster || !ins) return <div className="app"><div className="loading">Laster rapport...</div></div>

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .app { max-width: 100% !important; }
          body { background: white !important; }
          .scroll { padding: 0 24px !important; overflow: visible !important; }
          .reol-print-block { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>

      <div className="app">
        <div className="topbar no-print">
          <button className="back-btn" onClick={() => router.back()}>Tilbake</button>
          <h1>Inspeksjonsrapport</h1>
        </div>

        <div className="scroll">
          {/* Kun ved print */}
          <div className="print-only" style={{ marginBottom: 20, borderBottom: '2px solid #1D9E75', paddingBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1D9E75', marginBottom: 4 }}>Reolkontrollrapport</div>
            <div style={{ fontSize: 13, color: '#444' }}>
              <strong>{ins.kunde}</strong> · {ins.adresse} · {ins.dato} · Inspektor: {ins.inspektor}
            </div>
          </div>

          {/* Kundekort */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>{ins.kunde}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{ins.adresse} · {ins.dato} · Inspektor: {ins.inspektor}</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="badge bb">{reoler.length} reoler kontrollert</span>
              {g > 0 && <span className="badge bg">{g} godkjent</span>}
              {y > 0 && <span className="badge by">{y} gul skade</span>}
              {r > 0 && <span className="badge br">{r} rod — steng!</span>}
            </div>
          </div>

          {/* Rod varsel */}
          {r > 0 && (
            <div style={{ background: '#fdf4f4', border: '2px solid #A32D2D', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: '#791F1F', fontSize: 15 }}>
                VIKTIG: {r} reol{r > 1 ? 'er' : ''} med alvorlig skade
              </div>
              <div style={{ color: '#A32D2D', fontSize: 13, marginTop: 4 }}>
                Disse reolene ma stenges umiddelbart og ikke brukes for reparasjon er utfort og godkjent.
              </div>
            </div>
          )}

          {/* Reoler */}
          <div className="sec-label">Resultat per reol</div>
          {reoler.map(rl => {
            const st = reolVersteSkade(rl)
            const funn = rl.seksjoner.flatMap(sek =>
              sek.nivaer.filter(n => n.skade !== 'g').map(n => ({
                sek: sek.seksjon_index + 1, niv: n.nivaa_index + 1,
                skade: n.skade, kommentar: n.kommentar, bilder: n.bilder
              }))
            )
            return (
              <div key={rl.id} className="reol-print-block" style={{
                background: fbg(st), borderLeft: `4px solid ${fc(st)}`,
                borderRadius: '0 8px 8px 0', padding: '12px 14px', marginBottom: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: fc(st) }}>{rl.reolnummer} — {rl.reoltype}</div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: fbg(st), color: fc(st), border: `1px solid ${fc(st)}`, whiteSpace: 'nowrap' }}>
                    {ft(st)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  {rl.produsent} · {rl.antall_seksjoner} seksjoner · {rl.antall_nivaer} hyllenivaer
                </div>
                {rl.godkjent || funn.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#1D9E75', fontWeight: 600 }}>
                    Ingen funn — reolen er godkjent
                  </div>
                ) : (
                  funn.map((f, i) => (
                    <div key={i} style={{ paddingLeft: 12, marginBottom: 8, borderLeft: `2px solid ${fc(f.skade)}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: fc(f.skade) }}>
                        Seksjon {f.sek}, nivaa {f.niv}: {nt(f.skade)}
                      </div>
                      {f.kommentar && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{f.kommentar}</div>}
                      {f.bilder.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                          {f.bilder.map((b: any) => (
                            <img key={b.id} src={b.data} alt="Skade"
                              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid #ddd' }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )
          })}

          {/* Tiltakstabell */}
          {alleTiltak.length > 0 && (
            <>
              <div className="sec-label" style={{ marginTop: 8 }}>Krav til utbedring</div>
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.12)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f0f0ee', borderBottom: '1px solid #ddd' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Reol</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Sek.</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Nivaa</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Tiltak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alleTiltak.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #eee', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '8px 12px' }}>{t.reol}</td>
                        <td style={{ padding: '8px 12px' }}>{t.sek}</td>
                        <td style={{ padding: '8px 12px' }}>{t.niv}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: fc(t.skade) }}>
                          {nt(t.skade)}
                          {t.kommentar && <span style={{ fontWeight: 400, color: '#666' }}> — {t.kommentar}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Signatur for print */}
          <div className="print-only" style={{ marginTop: 48, display: 'flex', gap: 40 }}>
            <div style={{ flex: 1, borderTop: '1px solid #999', paddingTop: 6, fontSize: 12, color: '#666' }}>
              Inspektors underskrift
            </div>
            <div style={{ flex: 1, borderTop: '1px solid #999', paddingTop: 6, fontSize: 12, color: '#666' }}>
              Kundens underskrift
            </div>
          </div>

          {/* Handlingsknapper */}
          <div className="no-print" style={{ marginTop: 16 }}>
            <button className="btn btn-p" onClick={() => window.print()}>
              Skriv ut / lagre som PDF
            </button>
            <div style={{ fontSize: 12, color: '#888', marginTop: 6, textAlign: 'center' }}>
              Velg "Lagre som PDF" i utskriftsdialogen
            </div>

            {epostSendt && (
              <div className="suksess-box" style={{ marginTop: 12 }}>
                Rapport sendt til {mottaker}
              </div>
            )}

            {!visEpost && !epostSendt && (
              <button className="btn btn-s" style={{ marginTop: 8 }} onClick={() => setVisEpost(true)}>
                Send rapport pa e-post
              </button>
            )}

            {visEpost && (
              <div style={{ background: '#fff', border: '0.5px solid rgba(0,0,0,0.15)', borderRadius: 10, padding: 14, marginTop: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Send rapport pa e-post</div>
                {epostFeil && <div className="error-box">{epostFeil}</div>}
                <div className="fg" style={{ marginBottom: 8 }}>
                  <label>Mottakers e-postadresse</label>
                  <input type="email" value={mottaker} onChange={e => setMottaker(e.target.value)} placeholder="kunde@firma.no" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-p" style={{ margin: 0 }}
                    onClick={sendRapport} disabled={senderEpost || !mottaker.trim()}>
                    {senderEpost ? 'Sender...' : 'Send'}
                  </button>
                  <button className="btn btn-s" style={{ margin: 0 }} onClick={() => setVisEpost(false)}>
                    Avbryt
                  </button>
                </div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                  Konfigurer e-postkonto under "E-post" pa startsiden.
                </div>
              </div>
            )}

            <button className="btn btn-s" style={{ marginTop: 8 }} onClick={() => router.back()}>
              Tilbake til inspeksjon
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
