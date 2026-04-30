import { Redis } from '@upstash/redis'
import { v4 as uuidv4 } from 'uuid'
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export type Skade = 'g' | 'y' | 'r'

export interface Inspeksjon {
  id: string
  kunde: string
  adresse: string
  kontakt: string
  dato: string
  inspektor: string
  opprettet: string
}

export interface Reol {
  id: string
  inspeksjon_id: string
  reolnummer: string
  reoltype: string
  produsent: string
  antall_seksjoner: number
  antall_nivaer: number
  godkjent: boolean
  opprettet: string
}

export interface Seksjon {
  id: string
  reol_id: string
  seksjon_index: number
  skade: Skade
  kommentar: string
}

export interface Nivaa {
  id: string
  seksjon_id: string
  nivaa_index: number
  skade: Skade
  kommentar: string
}

export interface Bilde {
  id: string
  nivaa_id: string
  filnavn: string
  data: string
  opprettet: string
}

export interface NivaaMedBilder extends Nivaa {
  bilder: Bilde[]
}

export interface SeksjonMedNivaer extends Seksjon {
  nivaer: NivaaMedBilder[]
}

export interface ReolMedData extends Reol {
  seksjoner: SeksjonMedNivaer[]
}

export interface EpostInnstillinger {
  host: string
  port: number
  bruker: string
  passord: string
  fra: string
}

interface DB {
  inspeksjoner: Inspeksjon[]
  reoler: Reol[]
  seksjoner: Seksjon[]
  nivaer: Nivaa[]
  bilder: Bilde[]
}

const TOM_DB: DB = { inspeksjoner: [], reoler: [], seksjoner: [], nivaer: [], bilder: [] }

async function lesListe<K extends keyof DB>(nokkel: K): Promise<DB[K]> {
  const data = await redis.get<DB[K]>(nokkel)
  return Array.isArray(data) ? data : TOM_DB[nokkel]
}

async function lesDB(): Promise<DB> {
  const [inspeksjoner, reoler, seksjoner, nivaer, bilder] = await Promise.all([
    lesListe('inspeksjoner'),
    lesListe('reoler'),
    lesListe('seksjoner'),
    lesListe('nivaer'),
    lesListe('bilder'),
  ])
  return { inspeksjoner, reoler, seksjoner, nivaer, bilder }
}

async function skrivDB(db: DB): Promise<void> {
  await Promise.all([
    redis.set('inspeksjoner', db.inspeksjoner),
    redis.set('reoler', db.reoler),
    redis.set('seksjoner', db.seksjoner),
    redis.set('nivaer', db.nivaer),
    redis.set('bilder', db.bilder),
  ])
}

export function reolVersteSkade(reol: ReolMedData): Skade {
  if (reol.godkjent) return 'g'
  let worst: Skade = 'g'
  for (const sek of reol.seksjoner) {
    if (sek.skade === 'r') return 'r'
    if (sek.skade === 'y') worst = 'y'
    for (const niv of sek.nivaer) {
      if (niv.skade === 'r') return 'r'
      if (niv.skade === 'y') worst = 'y'
    }
  }
  return worst
}

// ---- Inspeksjoner ----

export async function dbHentInspeksjoner(): Promise<Inspeksjon[]> {
  const db = await lesDB()
  return db.inspeksjoner.sort((a, b) =>
    new Date(b.opprettet).getTime() - new Date(a.opprettet).getTime()
  )
}

export async function dbOpprettInspeksjon(data: Omit<Inspeksjon, 'id' | 'opprettet'>): Promise<Inspeksjon> {
  const db = await lesDB()
  const ny: Inspeksjon = { ...data, id: uuidv4(), opprettet: new Date().toISOString() }
  db.inspeksjoner.push(ny)
  await skrivDB(db)
  return ny
}

export async function dbSlettInspeksjon(id: string): Promise<void> {
  const db = await lesDB()
  const reolIds = db.reoler.filter(r => r.inspeksjon_id === id).map(r => r.id)
  const sekIds = db.seksjoner.filter(s => reolIds.includes(s.reol_id)).map(s => s.id)
  const nivIds = db.nivaer.filter(n => sekIds.includes(n.seksjon_id)).map(n => n.id)
  db.bilder = db.bilder.filter(b => !nivIds.includes(b.nivaa_id))
  db.nivaer = db.nivaer.filter(n => !sekIds.includes(n.seksjon_id))
  db.seksjoner = db.seksjoner.filter(s => !reolIds.includes(s.reol_id))
  db.reoler = db.reoler.filter(r => r.inspeksjon_id !== id)
  db.inspeksjoner = db.inspeksjoner.filter(i => i.id !== id)
  await skrivDB(db)
}

// ---- Reoler ----

export async function dbHentReoler(inspeksjonId: string): Promise<ReolMedData[]> {
  const db = await lesDB()
  return db.reoler
    .filter(r => r.inspeksjon_id === inspeksjonId)
    .sort((a, b) => new Date(a.opprettet).getTime() - new Date(b.opprettet).getTime())
    .map(reol => ({
      ...reol,
      seksjoner: db.seksjoner
        .filter(s => s.reol_id === reol.id)
        .sort((a, b) => a.seksjon_index - b.seksjon_index)
        .map(sek => ({
          ...sek,
          nivaer: db.nivaer
            .filter(n => n.seksjon_id === sek.id)
            .sort((a, b) => a.nivaa_index - b.nivaa_index)
            .map(niv => ({
              ...niv,
              bilder: db.bilder
                .filter(b => b.nivaa_id === niv.id)
                .sort((a, b) => new Date(a.opprettet).getTime() - new Date(b.opprettet).getTime())
            }))
        }))
    }))
}

export async function dbOpprettReol(data: Omit<Reol, 'id' | 'opprettet'>): Promise<Reol> {
  const db = await lesDB()
  const ny: Reol = { ...data, id: uuidv4(), opprettet: new Date().toISOString() }
  db.reoler.push(ny)
  await skrivDB(db)
  return ny
}

export async function dbOpprettSeksjonerOgNivaer(reolId: string, antallSeksjoner: number, antallNivaer: number): Promise<void> {
  const db = await lesDB()
  for (let s = 0; s < antallSeksjoner; s++) {
    const sek: Seksjon = { id: uuidv4(), reol_id: reolId, seksjon_index: s, skade: 'g', kommentar: '' }
    db.seksjoner.push(sek)
    for (let n = 0; n < antallNivaer; n++) {
      db.nivaer.push({ id: uuidv4(), seksjon_id: sek.id, nivaa_index: n, skade: 'g', kommentar: '' })
    }
  }
  await skrivDB(db)
}

export async function dbOppdaterReol(id: string, data: Partial<Pick<Reol, 'reolnummer' | 'reoltype' | 'produsent' | 'godkjent'>>): Promise<void> {
  const db = await lesDB()
  const idx = db.reoler.findIndex(r => r.id === id)
  if (idx === -1) throw new Error('Reol ikke funnet')
  db.reoler[idx] = { ...db.reoler[idx], ...data }
  await skrivDB(db)
}

export async function dbSlettReol(id: string): Promise<void> {
  const db = await lesDB()
  const sekIds = db.seksjoner.filter(s => s.reol_id === id).map(s => s.id)
  const nivIds = db.nivaer.filter(n => sekIds.includes(n.seksjon_id)).map(n => n.id)
  db.bilder = db.bilder.filter(b => !nivIds.includes(b.nivaa_id))
  db.nivaer = db.nivaer.filter(n => !sekIds.includes(n.seksjon_id))
  db.seksjoner = db.seksjoner.filter(s => s.reol_id !== id)
  db.reoler = db.reoler.filter(r => r.id !== id)
  await skrivDB(db)
}

// ---- Seksjoner og nivaer ----

export async function dbOppdaterSeksjon(id: string, data: Partial<Pick<Seksjon, 'skade' | 'kommentar'>>): Promise<void> {
  const db = await lesDB()
  const idx = db.seksjoner.findIndex(s => s.id === id)
  if (idx === -1) throw new Error('Seksjon ikke funnet')
  db.seksjoner[idx] = { ...db.seksjoner[idx], ...data }
  await skrivDB(db)
}

export async function dbOppdaterNivaa(id: string, data: Partial<Pick<Nivaa, 'skade' | 'kommentar'>>): Promise<void> {
  const db = await lesDB()
  const idx = db.nivaer.findIndex(n => n.id === id)
  if (idx === -1) throw new Error('Nivaa ikke funnet')
  db.nivaer[idx] = { ...db.nivaer[idx], ...data }
  await skrivDB(db)
}

// ---- Bilder ----

export async function dbLagreBilde(nivaId: string, filnavn: string, data: string): Promise<Bilde> {
  const db = await lesDB()
  const ny: Bilde = { id: uuidv4(), nivaa_id: nivaId, filnavn, data, opprettet: new Date().toISOString() }
  db.bilder.push(ny)
  await skrivDB(db)
  return ny
}

export async function dbSlettBilde(id: string): Promise<void> {
  const db = await lesDB()
  db.bilder = db.bilder.filter(b => b.id !== id)
  await skrivDB(db)
}

// ---- E-post ----

export async function hentEpostInnstillinger(): Promise<EpostInnstillinger | null> {
  const data = await redis.get<EpostInnstillinger>('epostInnstillinger')
  return data ?? null
}

export async function lagreEpostInnstillinger(data: EpostInnstillinger): Promise<void> {
  await redis.set('epostInnstillinger', data)
}
