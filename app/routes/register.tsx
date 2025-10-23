import { Either, Schema } from 'effect'
import { Form, Link, redirect } from 'react-router'
import { hashPassword } from '~/auth/password-hashing.server'
import { Email, type Customer } from '~/auth/schemas.server'
import { db } from '~/db.server'
import { Toaster, toast } from 'sonner'
import type { Route } from './+types/register'
import { useEffect } from 'react'

export async function action({ request }: { request: Request }) {
  //
  // Extract and validate form data
  //
  const formData = await request.formData()
  const _name = String(formData.get('name') || '').trim()
  const _email = String(formData.get('email') || '').trim()
  const _phone = String(formData.get('phone') || '').trim()
  const _password = String(formData.get('password') || '').trim()

  // Basic validation
  if (!_name || !_email || !_password) {
    return {
      success: false,
      message: 'All fields are required',
    } as const
  }

  // Validate phone number
  const phoneRegex = /^\+?[1-9]\d{1,14}$/
  if (!phoneRegex.test(_phone)) {
    return { success: false, message: 'Invalid phone number' } as const
  }

  // Validate email format
  const emailDecodeResult = Schema.decodeUnknownEither(Email)(_email)
  if (Either.isLeft(emailDecodeResult)) {
    return { success: false, message: 'Invalid email address' } as const
  }
  const email = emailDecodeResult.right

  //
  // Verify if email already exists
  //
  const existing = db
    .prepare<Email, Customer>('SELECT * FROM customers WHERE email = ?')
    .get(email)

  if (existing) {
    return { success: false, message: 'Email already registered' } as const
  }

  //
  // Create new customer
  //

  const insert = db.prepare<[string, Email, string]>(
    'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)'
  )
  const result = insert.run(_name, email, _phone)
  const customerId = result.lastInsertRowid

  //
  // Hash and store password
  //
  const passwordHash = await hashPassword(_password)
  db.prepare<[number | bigint, string]>(
    `INSERT INTO password_hashes (customer_id, hash) VALUES (?, ?)`
  ).run(customerId, passwordHash)

  return redirect('/login')
}

export default function Register({ actionData }: Route.ComponentProps) {
  const maybeErrMsg = actionData?.success === false ? actionData.message : null

  useEffect(() => {
    if (maybeErrMsg) {
      toast.error(maybeErrMsg, {
        duration: 4000,
        position: 'top-center',
      })
    }
  }, [actionData])

  return (
    <div>
      <title>Register | Football Ticketing Web App</title>
      <meta
        property="og:title"
        content="Register | Football Ticketing Web App"
      />
      <meta
        name="description"
        content="Create an account to manage your football tickets"
      />
      <main className="min-h-screen relative flex items-center justify-center p-6">
        <Toaster />
        {/* Background gradient with subtle blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(255,255,255,0.55),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(0,0,0,0.05),transparent_60%),linear-gradient(180deg,rgb(248_250_252),rgb(238_242_247))] dark:bg-[radial-gradient(1200px_600px_at_-10%_-10%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(900px_500px_at_110%_10%,rgba(255,255,255,0.04),transparent_60%),linear-gradient(180deg,rgb(2_6_23),rgb(2_6_23))]" />
          {/* Subtle neutral stripes */}
          <div className="absolute inset-0 opacity-20 dark:opacity-10 [mask-image:linear-gradient(to_bottom,black,transparent_85%)] bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.06)_0_24px,transparent_24px_48px)] dark:bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.04)_0_24px,transparent_24px_48px)]" />
          <div className="absolute top-32 left-10 h-56 w-56 rounded-full bg-white/40 dark:bg-white/12 blur-[80px]" />
          <div className="absolute bottom-24 right-12 h-64 w-64 rounded-full bg-black/10 dark:bg-white/6 blur-[96px]" />
        </div>

        <div className="w-full max-w-md">
          <div className="relative rounded-3xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/[0.02] p-8 shadow-[0_10px_50px_-10px_rgba(2,6,23,0.25)] dark:shadow-[0_10px_50px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/40 dark:ring-white/10 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
            <div className="pointer-events-none absolute -top-10 left-10 h-20 w-20 rounded-full bg-white/50 dark:bg-white/10 blur-2xl" />

            <header className="mb-8 text-center">
              <h1 className="text-2xl font-semibold">Create account</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-white/60">
                Join to start booking
              </p>
            </header>

            <Form method="post" className="space-y-6" replace>
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-slate-800 dark:text-white/80"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="block w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 shadow-inner outline-none transition focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-800 dark:text-white/80"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="block w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 shadow-inner outline-none transition focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium text-slate-800 dark:text-white/80"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="block w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 shadow-inner outline-none transition focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  placeholder="+66 8X XXX XXXX"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-medium text-slate-800 dark:text-white/80"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="block w-full rounded-xl border border-slate-900/10 dark:border-white/15 bg-white/70 dark:bg-white/5 px-4 py-3 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-white/40 shadow-inner outline-none transition focus:border-slate-900/20 dark:focus:border-white/30 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/20"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-slate-900 text-white dark:bg-white/90 dark:text-slate-900 px-4 py-3 font-medium shadow transition hover:bg-slate-800 dark:hover:bg-white"
              >
                <span className="relative z-10">Create account</span>
                <span className="absolute inset-0 -z-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0 opacity-0 transition group-hover:opacity-100" />
              </button>
            </Form>

            <p className="mt-6 text-center text-sm text-slate-700 dark:text-white/70">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-slate-900 hover:underline dark:text-white"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
