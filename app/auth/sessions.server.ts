import { createCookieSessionStorage } from 'react-router'

export const cookieSessionStorage = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    secrets: process.env.COOKIE_SECRETS?.split(',') ?? [],
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
})
