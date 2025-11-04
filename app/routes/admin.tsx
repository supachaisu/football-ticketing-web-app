import { Form, Link, data, redirect } from 'react-router'
import type { Route } from './+types/admin'
import { cookieSessionStorage } from '~/auth/sessions.server'
import { db } from '~/db.server'
import { useState } from 'react'

type AdminMatch = {
  match_id: number
  home_team: string
  away_team: string
  match_date: string
  stadium: string
  tickets_total: number
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await cookieSessionStorage.getSession(
    request.headers.get('Cookie')
  )
  const isAdmin = Boolean(session.get('isAdmin'))
  if (!isAdmin) {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  const matches = db
    .prepare(
      `SELECT match_id, home_team, away_team, match_date, stadium, tickets_total
         FROM matches
         ORDER BY datetime(match_date) DESC`
    )
    .all() as AdminMatch[]

  return data({ matches } as const)
}

function parsePositiveInt(value: FormDataEntryValue | null): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  if (n <= 0) return null
  return Math.floor(n)
}

export async function action({ request }: Route.ActionArgs) {
  const session = await cookieSessionStorage.getSession(
    request.headers.get('Cookie')
  )
  const isAdmin = Boolean(session.get('isAdmin'))
  if (!isAdmin) {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  const form = await request.formData()
  const intent = String(form.get('_action') || '')

  if (intent === 'sign-out') {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.destroySession(session),
      },
    })
  }

  if (intent === 'delete-match') {
    const matchId = Number(form.get('match_id'))
    if (!Number.isFinite(matchId)) {
      return data({ formError: 'Invalid match id.' }, { status: 400 })
    }

    const res = db
      .prepare(`DELETE FROM matches WHERE match_id = ?`)
      .run(matchId)

    if (!res.changes) {
      return data(
        { formError: 'Match not found or already deleted.' },
        { status: 404 }
      )
    }

    return redirect('/admin', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  if (intent === 'update-match') {
    const matchId = Number(form.get('match_id'))
    if (!Number.isFinite(matchId)) {
      return data({ formError: 'Invalid match id.' }, { status: 400 })
    }

    const home_team = String(form.get('home_team') || '').trim()
    const away_team = String(form.get('away_team') || '').trim()
    const stadium = String(form.get('stadium') || '').trim()
    const tickets_total = parsePositiveInt(form.get('tickets_total'))

    const rawDate = String(form.get('match_date') || '').trim()
    let match_date: string | null = null
    if (rawDate) {
      const d = new Date(rawDate)
      if (!isNaN(d.getTime())) {
        match_date = d.toISOString()
      }
    }

    if (!home_team || !away_team || !stadium || !match_date || !tickets_total) {
      return data(
        {
          formError:
            'All fields are required and tickets must be a positive number.',
        },
        { status: 400 }
      )
    }

    if (home_team.toLowerCase() === away_team.toLowerCase()) {
      return data(
        {
          formError: 'Home and away teams must be different.',
        },
        { status: 400 }
      )
    }

    const res = db
      .prepare(
        `UPDATE matches
           SET home_team = ?,
               away_team = ?,
               match_date = ?,
               stadium = ?,
               tickets_total = ?,
               updated_at = CURRENT_TIMESTAMP
         WHERE match_id = ?`
      )
      .run(home_team, away_team, match_date, stadium, tickets_total, matchId)

    if (!res.changes) {
      return data({ formError: 'Match not found.' }, { status: 404 })
    }

    return redirect('/admin', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  if (intent !== 'create-match') {
    return data({ formError: 'Unsupported action.' }, { status: 400 })
  }

  const home_team = String(form.get('home_team') || '').trim()
  const away_team = String(form.get('away_team') || '').trim()
  const stadium = String(form.get('stadium') || '').trim()
  const tickets_total = parsePositiveInt(form.get('tickets_total'))

  const rawDate = String(form.get('match_date') || '').trim()
  let match_date: string | null = null
  if (rawDate) {
    const d = new Date(rawDate)
    if (!isNaN(d.getTime())) {
      match_date = d.toISOString()
    }
  }

  if (!home_team || !away_team || !stadium || !match_date || !tickets_total) {
    return data(
      {
        formError:
          'All fields are required and tickets must be a positive number.',
        fields: { home_team, away_team, stadium, match_date: rawDate, tickets_total: String(tickets_total ?? '') },
      },
      { status: 400 }
    )
  }

  if (home_team.toLowerCase() === away_team.toLowerCase()) {
    return data(
      {
        formError: 'Home and away teams must be different.',
        fields: { home_team, away_team, stadium, match_date: rawDate, tickets_total: String(tickets_total) },
      },
      { status: 400 }
    )
  }

  // Insert the match
  db.prepare(
    `INSERT INTO matches (home_team, away_team, match_date, stadium, tickets_total)
     VALUES (?, ?, ?, ?, ?)`
  ).run(home_team, away_team, match_date, stadium, tickets_total)

  return redirect('/admin', {
    headers: {
      'Set-Cookie': await cookieSessionStorage.commitSession(session),
    },
  })
}

export default function AdminDashboard({ loaderData, actionData }: Route.ComponentProps) {
  const matches = loaderData?.matches ?? []
  const err = actionData?.formError as string | undefined
  const [deleteMatchId, setDeleteMatchId] = useState<number | null>(null)
  const [deleteMatchLabel, setDeleteMatchLabel] = useState<string>('')
  const [editMatch, setEditMatch] = useState<AdminMatch | null>(null)
  const now = Date.now()
  const upcoming = matches
    .filter((m) => new Date(m.match_date).getTime() >= now)
    .sort(
      (a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    )
  const past = matches
    .filter((m) => new Date(m.match_date).getTime() < now)
    .sort(
      (a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
    )

  return (
    <div className="min-h-screen pb-16">
      <title>Admin | Manage Matches</title>
      <meta name="description" content="Add new matches and manage schedule." />

      <header className="sticky top-0 z-30 border-b border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="font-semibold tracking-tight">
            Football Ticketing — Admin
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-white/70">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/15"
            >
              User Dashboard
            </Link>
            <Form method="post" replace>
              <input type="hidden" name="_action" value="sign-out" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/15"
              >
                Log out
              </button>
            </Form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Add a new match
          </h1>
          <p className="text-slate-600 dark:text-white/70">
            Fill in the details and publish to the schedule.
          </p>
        </div>

        {err ? (
          <div className="rounded-xl border border-red-300/60 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-200">
            <strong className="font-medium">Error:</strong> {err}
          </div>
        ) : null}

        <section className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur">
          <div className="p-5 border-b border-slate-900/10 dark:border-white/10">
            <h2 className="text-lg font-medium">New Match</h2>
            <p className="text-sm text-slate-600 dark:text-white/60">
              Teams, date/time, stadium, and total tickets.
            </p>
          </div>
          <div className="p-5">
            <Form method="post" replace className="grid gap-4 max-w-2xl">
              <input type="hidden" name="_action" value="create-match" />

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="home_team" className="text-sm font-medium">
                    Home team
                  </label>
                  <input
                    id="home_team"
                    name="home_team"
                    required
                    placeholder="Bangkok United"
                    className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="away_team" className="text-sm font-medium">
                    Away team
                  </label>
                  <input
                    id="away_team"
                    name="away_team"
                    required
                    placeholder="Chiang Mai FC"
                    className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="match_date" className="text-sm font-medium">
                    Date & time
                  </label>
                  <input
                    id="match_date"
                    name="match_date"
                    type="datetime-local"
                    required
                    className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="stadium" className="text-sm font-medium">
                    Stadium
                  </label>
                  <input
                    id="stadium"
                    name="stadium"
                    required
                    placeholder="Thammasat Stadium"
                    className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  />
                </div>
              </div>

              <div className="grid sm:max-w-xs gap-2">
                <label htmlFor="tickets_total" className="text-sm font-medium">
                  Total tickets
                </label>
                <input
                  id="tickets_total"
                  name="tickets_total"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={20000}
                  className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                />
                <p className="text-xs text-slate-600 dark:text-white/60">
                  Must be a positive whole number.
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900 px-4 py-2.5 font-medium shadow hover:bg-slate-800 dark:hover:bg-white"
                >
                  Create match
                </button>
              </div>
            </Form>
          </div>
        </section>

        <section className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-lg font-medium">Upcoming Matches</h2>
            {upcoming.length === 0 ? (
              <p className="text-slate-600 dark:text-white/60">No upcoming matches.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map((m) => (
                  <div
                    key={m.match_id}
                    className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur p-4 space-y-2"
                  >
                    <div className="font-medium">
                      {m.home_team} vs {m.away_team}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-white/70">
                      {new Date(m.match_date).toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      @ {m.stadium}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      Tickets: {m.tickets_total}
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMatch(m)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteMatchId(m.match_id)
                          setDeleteMatchLabel(`${m.home_team} vs ${m.away_team}`)
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/40 bg-white text-red-700 dark:bg-white/10 dark:text-red-300 px-3 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-white/15"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium">Past Matches</h2>
            {past.length === 0 ? (
              <p className="text-slate-600 dark:text-white/60">No past matches.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {past.map((m) => (
                  <div
                    key={m.match_id}
                    className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur p-4 space-y-2"
                  >
                    <div className="font-medium">
                      {m.home_team} vs {m.away_team}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-white/70">
                      {new Date(m.match_date).toLocaleString()}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      @ {m.stadium}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-white/60">
                      Tickets: {m.tickets_total}
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditMatch(m)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteMatchId(m.match_id)
                          setDeleteMatchLabel(`${m.home_team} vs ${m.away_team}`)
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/40 bg-white text-red-700 dark:bg-white/10 dark:text-red-300 px-3 py-2 text-sm font-medium hover:bg-red-50 dark:hover:bg-white/15"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      {editMatch !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-match-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setEditMatch(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-lg rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 id="edit-match-title" className="text-lg font-medium">
              Edit match
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
              Update the match details and save your changes.
            </p>

            <div className="mt-4">
              <Form method="post" replace onSubmit={() => setEditMatch(null)} className="grid gap-4">
                <input type="hidden" name="_action" value="update-match" />
                <input type="hidden" name="match_id" value={editMatch?.match_id ?? ''} />

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="edit_home_team" className="text-sm font-medium">Home team</label>
                    <input
                      id="edit_home_team"
                      name="home_team"
                      required
                      defaultValue={editMatch?.home_team ?? ''}
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit_away_team" className="text-sm font-medium">Away team</label>
                    <input
                      id="edit_away_team"
                      name="away_team"
                      required
                      defaultValue={editMatch?.away_team ?? ''}
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label htmlFor="edit_match_date" className="text-sm font-medium">Date & time</label>
                    <input
                      id="edit_match_date"
                      name="match_date"
                      type="datetime-local"
                      required
                      defaultValue={(editMatch ? (() => { const d = new Date(editMatch.match_date); const tz = d.getTimezoneOffset(); const local = new Date(d.getTime() - tz * 60000); return local.toISOString().slice(0,16) })() : '')}
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="edit_stadium" className="text-sm font-medium">Stadium</label>
                    <input
                      id="edit_stadium"
                      name="stadium"
                      required
                      defaultValue={editMatch?.stadium ?? ''}
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    />
                  </div>
                </div>

                <div className="grid sm:max-w-xs gap-2">
                  <label htmlFor="edit_tickets_total" className="text-sm font-medium">Total tickets</label>
                  <input
                    id="edit_tickets_total"
                    name="tickets_total"
                    type="number"
                    min={1}
                    step={1}
                    required
                    defaultValue={editMatch?.tickets_total ?? 1}
                    className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditMatch(null)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900 px-4 py-2 text-sm font-medium shadow hover:bg-slate-800 dark:hover:bg-white"
                  >
                    Save changes
                  </button>
                </div>
              </Form>
            </div>
          </div>
        </div>
      )}
      {deleteMatchId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-match-title"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setDeleteMatchId(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-md rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 id="delete-match-title" className="text-lg font-medium">
              Delete match?
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-white/70">
              This will permanently remove <span className="font-medium">{deleteMatchLabel}</span>.
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-white/70">
              Related bookings, tickets, and payments will also be deleted.
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteMatchId(null)}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15"
              >
                Cancel
              </button>
              <Form method="post" replace onSubmit={() => setDeleteMatchId(null)}>
                <input type="hidden" name="_action" value="delete-match" />
                <input type="hidden" name="match_id" value={deleteMatchId ?? ''} />
                <button
                  type="submit"
                  autoFocus
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-medium shadow hover:bg-red-700"
                >
                  Delete
                </button>
              </Form>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}