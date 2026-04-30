import type { Inspeksjon, Reol, ReolMedData, Skade, Bilde } from './db'
export type { Inspeksjon, Reol, ReolMedData, Skade, Bilde }
export type { Seksjon, Nivaa, NivaaMedBilder, SeksjonMedNivaer } from './db'
export { reolVersteSkade } from './db'

const API = '/api'

async function get(handling: string, params?: Record<string, string>) {
  const url = new URL(API, window.location.href)
  url.searchParams.set('handling', handling)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const data = await res.json()
  if (data.feil) throw new Error(data.feil)
  return data
}

async function post(body: object) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.feil) throw new Error(data.feil)
  return data
}

export const hentInspeksjoner = (): Promise<Inspeksjon[]> => get('inspeksjoner')
export const opprettInspeksjon = (data: Omit<Inspeksjon, 'id' | 'opprettet'>): Promise<Inspeksjon> => post({ handling: 'opprettInspeksjon', data })
export const slettInspeksjon = (id: string): Promise<void> => post({ handling: 'slettInspeksjon', id })

export const hentReoler = (inspeksjonId: string): Promise<ReolMedData[]> => get('reoler', { inspeksjonId })
export const opprettReol = (data: Omit<Reol, 'id' | 'opprettet'>): Promise<Reol> => post({ handling: 'opprettReol', data })
export const opprettReolGodkjent = (data: Omit<Reol, 'id' | 'opprettet'>): Promise<Reol> => post({ handling: 'opprettReolGodkjent', data })
export const oppdaterReol = (id: string, data: Partial<Pick<Reol, 'reolnummer' | 'reoltype' | 'produsent'>>) => post({ handling: 'oppdaterReol', id, data })
export const slettReol = (id: string): Promise<void> => post({ handling: 'slettReol', id })

export const oppdaterSeksjon = (id: string, data: { skade?: Skade; kommentar?: string }): Promise<void> => post({ handling: 'oppdaterSeksjon', id, data })
export const oppdaterNivaa = (id: string, data: { skade?: Skade; kommentar?: string }): Promise<void> => post({ handling: 'oppdaterNivaa', id, data })

export const slettBilde = (bilde: Bilde): Promise<void> => post({ handling: 'slettBilde', id: bilde.id })

export function lastOppBilde(nivaId: string, fil: File): Promise<Bilde> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        resolve(await post({ handling: 'lagreBilde', nivaId, filnavn: fil.name, data: reader.result }))
      } catch (err) { reject(err) }
    }
    reader.onerror = () => reject(new Error('Kunne ikke lese filen'))
    reader.readAsDataURL(fil)
  })
}

export const hentEpostInnstillinger = (): Promise<any> => get('epostInnstillinger')
export const lagreEpostInnstillinger = (data: object): Promise<void> => post({ handling: 'lagreEpostInnstillinger', data })
export const sendEpostRapport = (inspeksjon: object, reoler: object[], tilMottaker: string): Promise<void> =>
  post({ handling: 'sendEpost', inspeksjon, reoler, tilMottaker })
