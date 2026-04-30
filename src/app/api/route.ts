import { NextRequest, NextResponse } from 'next/server'
import {
  dbHentInspeksjoner, dbOpprettInspeksjon, dbSlettInspeksjon,
  dbHentReoler, dbOpprettReol, dbOpprettSeksjonerOgNivaer, dbOppdaterReol, dbSlettReol,
  dbOppdaterSeksjon, dbOppdaterNivaa,
  dbLagreBilde, dbSlettBilde,
  hentEpostInnstillinger, lagreEpostInnstillinger,
} from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const handling = searchParams.get('handling')
  const inspeksjonId = searchParams.get('inspeksjonId')
  try {
    if (handling === 'inspeksjoner') return NextResponse.json(await dbHentInspeksjoner())
    if (handling === 'reoler' && inspeksjonId) return NextResponse.json(await dbHentReoler(inspeksjonId))
    if (handling === 'epostInnstillinger') {
      const inn = await hentEpostInnstillinger()
      if (inn) return NextResponse.json({ ...inn, passord: '••••••••', harPassord: true })
      return NextResponse.json(null)
    }
    return NextResponse.json({ feil: 'Ukjent handling' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ feil: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { handling } = body
  try {
    if (handling === 'opprettInspeksjon') return NextResponse.json(await dbOpprettInspeksjon(body.data))
    if (handling === 'slettInspeksjon') { await dbSlettInspeksjon(body.id); return NextResponse.json({ ok: true }) }
    if (handling === 'opprettReol') {
      const reol = await dbOpprettReol(body.data)
      await dbOpprettSeksjonerOgNivaer(reol.id, reol.antall_seksjoner, reol.antall_nivaer)
      return NextResponse.json(reol)
    }
    if (handling === 'opprettReolGodkjent') return NextResponse.json(await dbOpprettReol({ ...body.data, godkjent: true }))
    if (handling === 'oppdaterReol') { await dbOppdaterReol(body.id, body.data); return NextResponse.json({ ok: true }) }
    if (handling === 'slettReol') { await dbSlettReol(body.id); return NextResponse.json({ ok: true }) }
    if (handling === 'oppdaterSeksjon') { await dbOppdaterSeksjon(body.id, body.data); return NextResponse.json({ ok: true }) }
    if (handling === 'oppdaterNivaa') { await dbOppdaterNivaa(body.id, body.data); return NextResponse.json({ ok: true }) }
    if (handling === 'lagreBilde') return NextResponse.json(await dbLagreBilde(body.nivaId, body.filnavn, body.data))
    if (handling === 'slettBilde') { await dbSlettBilde(body.id); return NextResponse.json({ ok: true }) }
    if (handling === 'lagreEpostInnstillinger') {
      const inn = await hentEpostInnstillinger()
      const passord = body.data.passord || (inn?.passord ?? '')
      await lagreEpostInnstillinger({ ...body.data, passord })
      return NextResponse.json({ ok: true })
    }
    if (handling === 'sendEpost') return await sendEpost(body)
    return NextResponse.json({ feil: 'Ukjent handling' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ feil: err.message }, { status: 500 })
  }
}

async function sendEpost(body: any) {
  const nodemailer = await import('nodemailer')
  const inn = await hentEpostInnstillinger()
  if (!inn) return NextResponse.json({ feil: 'E-postinnstillinger ikke konfigurert. Ga til Innstillinger.' }, { status: 400 })

  const transport = nodemailer.default.createTransport({
    host: inn.host,
    port: inn.port,
    secure: inn.port === 465,
    auth: { user: inn.bruker, pass: inn.passord },
  })

  const { inspeksjon, reoler, tilMottaker } = body

  const fc = (sk: string) => sk === 'g' ? '#1D9E75' : sk === 'y' ? '#BA7517' : '#A32D2D'
  const nt = (sk: string) => sk === 'g' ? 'OK' : sk === 'y' ? 'Bytt innen 4 uker' : 'ALVORLIG — steng!'
  const st = (sk: string) => sk === 'g' ? 'Godkjent' : sk === 'y' ? 'Gul — innen 4 uker' : 'ROD — Steng!'

  const reolHtml = reoler.map((rl: any) => {
    const funn = rl.seksjoner.flatMap((s: any) =>
      s.nivaer.filter((n: any) => n.skade !== 'g')
        .map((n: any) => ({ sek: s.seksjon_index + 1, niv: n.nivaa_index + 1, skade: n.skade, kommentar: n.kommentar }))
    )
    const status = rl.godkjent || funn.length === 0 ? 'g' : funn.some((f: any) => f.skade === 'r') ? 'r' : 'y'
    return `
      <div style="border-left:4px solid ${fc(status)};background:${status==='g'?'#f5fbf7':status==='y'?'#fdf8f0':'#fdf4f4'};padding:12px 14px;margin-bottom:12px;border-radius:0 8px 8px 0">
        <div style="font-weight:700;font-size:15px;color:${fc(status)}">${rl.reolnummer} — ${rl.reoltype}
          <span style="float:right;font-size:12px">${st(status)}</span>
        </div>
        <div style="font-size:12px;color:#666;margin:2px 0 6px">${rl.produsent} · ${rl.antall_seksjoner} seksjoner</div>
        ${funn.length === 0
          ? '<p style="color:#1D9E75;font-size:13px;margin:0">Ingen funn — godkjent</p>'
          : funn.map((f: any) => `
            <div style="padding:4px 0 4px 12px;border-left:2px solid ${fc(f.skade)};margin-top:6px">
              <strong style="color:${fc(f.skade)};font-size:13px">Seksjon ${f.sek}, nivaa ${f.niv}: ${nt(f.skade)}</strong>
              ${f.kommentar ? `<br><span style="color:#555;font-size:12px">${f.kommentar}</span>` : ''}
            </div>`).join('')
        }
      </div>`
  }).join('')

  const html = `
    <div style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">
      <div style="background:#1D9E75;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Reolkontrollrapport</h1>
        <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${inspeksjon.kunde} · ${inspeksjon.dato}</p>
      </div>
      <div style="padding:20px 24px;background:#fff;border:1px solid #eee;border-top:none">
        <table style="font-size:13px;color:#666;margin-bottom:20px">
          <tr><td style="padding:3px 16px 3px 0">Kunde:</td><td><strong>${inspeksjon.kunde}</strong></td></tr>
          <tr><td style="padding:3px 16px 3px 0">Adresse:</td><td>${inspeksjon.adresse}</td></tr>
          <tr><td style="padding:3px 16px 3px 0">Kontakt:</td><td>${inspeksjon.kontakt}</td></tr>
          <tr><td style="padding:3px 16px 3px 0">Dato:</td><td>${inspeksjon.dato}</td></tr>
          <tr><td style="padding:3px 16px 3px 0">Inspektor:</td><td>${inspeksjon.inspektor}</td></tr>
        </table>
        <h2 style="font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px">Resultat per reol</h2>
        ${reolHtml}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:12px;color:#999;margin:0">Sendt fra Reolkontroll · ${new Date().toLocaleDateString('nb-NO')}</p>
      </div>
    </div>`

  try {
    await transport.sendMail({
      from: `"Reolkontroll" <${inn.fra || inn.bruker}>`,
      to: tilMottaker,
      subject: `Reolkontrollrapport — ${inspeksjon.kunde} ${inspeksjon.dato}`,
      html,
    })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ feil: `E-postfeil: ${err.message}` }, { status: 500 })
  }
}
