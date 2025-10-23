import { cookieSessionStorage } from '~/auth/sessions.server'
import { Form, redirect, Link, data } from 'react-router'
import type { Route } from './+types/dashboard'
import { findCustomerById } from '~/repositories/customer.repository'

// ---- Types that mirror the attached spec (Customer/Match/Booking/Payment) ----
// Minimal client-facing types for this route
export type UIMatch = {
  match_id: number
  home_team: string
  away_team: string
  match_date: string // ISO-8601
  stadium: string
  tickets_total: number
  tickets_sold: number
}

export type UIBooking = {
  booking_id: number
  customer_id: string
  match_id: number
  quantity: number
  booking_date: string // ISO-8601
  status: 'Pending' | 'Paid' | 'Cancel'
}

// ---- Helper to seed demo matches in the Session (so page works without DB) ----
function seedMatches(): UIMatch[] {
  const now = new Date()
  const inDays = (d: number) => new Date(now.getTime() + d * 86400000)
  const iso = (d: Date) => d.toISOString()
  return [
    {
      match_id: 101,
      home_team: 'Bangkok United',
      away_team: 'Chiang Mai FC',
      match_date: iso(inDays(7)),
      stadium: 'Thammasat Stadium',
      tickets_total: 30000,
      tickets_sold: 12345,
    },
    {
      match_id: 102,
      home_team: 'Muangthong Utd',
      away_team: 'Buriram Utd',
      match_date: iso(inDays(14)),
      stadium: 'SCG Stadium',
      tickets_total: 20000,
      tickets_sold: 15200,
    },
    {
      match_id: 103,
      home_team: 'Port FC',
      away_team: 'BG Pathum',
      match_date: iso(inDays(21)),
      stadium: 'PAT Stadium',
      tickets_total: 12000,
      tickets_sold: 9800,
    },
  ]
}

export async function loader({ request }: Route.LoaderArgs) {
  const session = await cookieSessionStorage.getSession(
    request.headers.get('Cookie')
  )
  const customerId = (session.get('customerId') as string | undefined) ?? null

  if (!customerId) {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.destroySession(session),
      },
    })
  }

  const customer = findCustomerById(Number(customerId))
  if (!customer) {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.destroySession(session),
      },
    })
  }

  // Seed matches into the session the first time so the page is usable
  let matches = session.get('matches') as UIMatch[] | undefined
  if (!matches || !Array.isArray(matches) || matches.length === 0) {
    matches = seedMatches()
    session.set('matches', matches)
  }

  const bookings = (session.get('bookings') as UIBooking[] | undefined) ?? []

  return data(
    {
      customerId,
      customerName: customer.name,
      matches,
      bookings,
    } as const,
    {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    }
  )
}

export async function action({ request }: Route.ActionArgs) {
  const session = await cookieSessionStorage.getSession(
    request.headers.get('Cookie')
  )
  const customerId = session.get('customerId') as string | undefined
  const formData = await request.formData()
  const intent = formData.get('_action')

  if (intent === 'sign-out') {
    return redirect('/login', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.destroySession(session),
      },
    })
  }

  if (intent === 'create-booking') {
    if (!customerId) {
      return data(
        {
          formError: 'Please sign in first. No customerId found in session.',
        },
        { status: 400 }
      )
    }

    const matchId = Number(formData.get('match_id'))
    const quantity = Number(formData.get('quantity'))

    if (!Number.isFinite(matchId)) {
      return data({ formError: 'Invalid match.' }, { status: 400 })
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) {
      return data(
        { formError: 'Quantity must be between 1 and 10.' },
        { status: 400 }
      )
    }

    const matches = (session.get('matches') as UIMatch[] | undefined) ?? []
    const match = matches.find((m) => m.match_id === matchId)
    if (!match) return data({ formError: 'Match not found.' }, { status: 404 })

    const remaining = match.tickets_total - match.tickets_sold
    if (quantity > remaining) {
      return data(
        { formError: `Only ${remaining} tickets remaining for this match.` },
        { status: 400 }
      )
    }

    // Create a Pending booking (per spec: Booking + Status)
    const booking: UIBooking = {
      booking_id: Date.now(),
      customer_id: customerId,
      match_id: match.match_id,
      quantity,
      booking_date: new Date().toISOString(),
      status: 'Pending',
    }

    const bookings = (session.get('bookings') as UIBooking[] | undefined) ?? []
    bookings.push(booking)
    session.set('bookings', bookings)

    // Reserve the tickets optimistically by increasing sold count
    match.tickets_sold += quantity
    session.set(
      'matches',
      matches.map((m) => (m.match_id === match.match_id ? match : m))
    )

    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  if (intent === 'cancel-booking') {
    const id = Number(formData.get('booking_id'))
    const bookings = (session.get('bookings') as UIBooking[] | undefined) ?? []
    const booking = bookings.find((b) => b.booking_id === id)
    if (!booking)
      return data({ formError: 'Booking not found.' }, { status: 404 })

    // Roll back reserved tickets
    const matches = (session.get('matches') as UIMatch[] | undefined) ?? []
    const match = matches.find((m) => m.match_id === booking.match_id)
    if (match) {
      match.tickets_sold = Math.max(0, match.tickets_sold - booking.quantity)
      session.set(
        'matches',
        matches.map((m) => (m.match_id === match.match_id ? match : m))
      )
    }

    // Mark booking as Cancel
    booking.status = 'Cancel'
    session.set('bookings', bookings)

    return redirect('/dashboard', {
      headers: {
        'Set-Cookie': await cookieSessionStorage.commitSession(session),
      },
    })
  }

  return data({ formError: 'Unsupported action.' }, { status: 400 })
}

export default function Dashboard({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { customerName, customerId, matches, bookings } = loaderData

  return (
    <div className="min-h-screen">
      <title>Dashboard | Football Ticketing</title>
      <meta
        name="description"
        content="Browse upcoming matches, book tickets, and manage your bookings."
      />

      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-slate-950/60 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="font-semibold tracking-tight">
            Football Ticketing
          </Link>
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-white/70">
            <span>
              Signed in as <span className="font-medium">{customerName}</span>
            </span>
            <span className="h-4 w-px bg-slate-900/10 dark:bg-white/10" />
            <Form method="post" replace>
              <input type="hidden" name="_action" value="sign-out" />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-white/15"
              >
                Sign out
              </button>
            </Form>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            Book tickets for upcoming matches
          </h1>
          <p className="text-slate-600 dark:text-white/70">
            Choose a match, set your quantity, and confirm your booking.
          </p>
        </div>

        {actionData?.formError ? (
          <div className="rounded-xl border border-red-300/60 dark:border-red-500/40 bg-red-50 dark:bg-red-950/40 p-4 text-red-700 dark:text-red-200">
            <strong className="font-medium">Error:</strong>{' '}
            {actionData.formError}
          </div>
        ) : null}

        {/* Matches + Booking */}
        <section className="grid lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur">
              <div className="p-5 border-b border-slate-900/10 dark:border-white/10">
                <h2 className="text-lg font-medium">Upcoming Matches</h2>
                <p className="text-sm text-slate-600 dark:text-white/60">
                  Select a match and quantity to reserve your seats.
                </p>
              </div>
              <div className="p-5">
                <Form method="post" replace className="grid gap-4">
                  <input type="hidden" name="_action" value="create-booking" />

                  <div className="grid gap-2">
                    <label htmlFor="match_id" className="text-sm font-medium">
                      Match
                    </label>
                    <select
                      id="match_id"
                      name="match_id"
                      required
                      defaultValue=""
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    >
                      <option value="" disabled>
                        Select a match
                      </option>
                      {matches.map((m) => {
                        const remaining = m.tickets_total - m.tickets_sold
                        const d = new Date(m.match_date)
                        const label = `${m.home_team} vs ${m.away_team} — ${d.toLocaleString()} @ ${m.stadium}`
                        return (
                          <option
                            key={m.match_id}
                            value={m.match_id}
                            disabled={remaining <= 0}
                          >
                            {label} {remaining <= 0 ? ' (Sold out)' : ''}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  <div className="grid gap-2 sm:max-w-xs">
                    <label htmlFor="quantity" className="text-sm font-medium">
                      Quantity
                    </label>
                    <input
                      id="quantity"
                      type="number"
                      name="quantity"
                      min={1}
                      max={10}
                      defaultValue={1}
                      required
                      className="w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-2.5 text-slate-900 dark:text-white shadow-inner outline-none focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                    />
                    <p className="text-xs text-slate-600 dark:text-white/60">
                      You can book up to 10 tickets per order.
                    </p>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={!customerId}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900 px-4 py-2.5 font-medium shadow hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Book ticket(s)
                    </button>
                    {!customerId && (
                      <p className="mt-2 text-xs text-slate-600 dark:text-white/60">
                        Please sign in to make a booking.
                      </p>
                    )}
                  </div>
                </Form>
              </div>
            </div>
          </div>

          {/* Availability side card */}
          <aside className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur p-5">
              <h3 className="text-base font-medium mb-3">Availability</h3>
              <div className="space-y-4">
                {matches.map((m) => {
                  const remaining = Math.max(
                    0,
                    m.tickets_total - m.tickets_sold
                  )
                  const pct = Math.max(
                    0,
                    Math.min(100, (remaining / m.tickets_total) * 100)
                  )
                  return (
                    <div key={m.match_id} className="space-y-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1 text-sm">
                        <div className="whitespace-normal break-words">
                          {m.home_team} vs {m.away_team}
                        </div>
                        <div className="tabular-nums text-slate-600 dark:text-white/60 sm:text-right">
                          {remaining}/{m.tickets_total}
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </section>

        {/* Bookings */}
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Your Bookings</h2>
          {bookings.length === 0 ? (
            <p className="text-slate-600 dark:text-white/60">
              No bookings yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bookings
                .filter((b) => !customerId || b.customer_id === customerId)
                .map((b) => {
                  const m = matches.find((mm) => mm.match_id === b.match_id)
                  const when = m ? new Date(m.match_date).toLocaleString() : '—'
                  const isPending = b.status === 'Pending'
                  return (
                    <div
                      key={b.booking_id}
                      className="rounded-2xl border border-slate-900/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.02] shadow-sm backdrop-blur p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm text-slate-600 dark:text-white/60">
                            Booking #{b.booking_id}
                          </div>
                          <div className="font-medium">
                            {m ? (
                              <>
                                {m.home_team} vs {m.away_team}
                              </>
                            ) : (
                              'Match removed'
                            )}
                          </div>
                        </div>
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ' +
                            (isPending
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                              : b.status === 'Paid'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                                : 'bg-slate-200 text-slate-800 dark:bg-white/10 dark:text-white/80')
                          }
                        >
                          {b.status}
                        </span>
                      </div>
                      <div className="text-sm text-slate-700 dark:text-white/70">
                        <div>{when}</div>
                        <div className="mt-0.5">Qty: {b.quantity}</div>
                        {m && (
                          <div className="mt-0.5 text-slate-600 dark:text-white/60">
                            @ {m.stadium}
                          </div>
                        )}
                      </div>
                      {isPending ? (
                        <Form method="post" replace>
                          <input
                            type="hidden"
                            name="_action"
                            value="cancel-booking"
                          />
                          <input
                            type="hidden"
                            name="booking_id"
                            value={b.booking_id}
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-900/10 dark:border-white/15 bg-white text-slate-900 dark:bg-white/10 dark:text-white px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/15"
                          >
                            Cancel booking
                          </button>
                        </Form>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
