import { cookieSessionStorage } from '~/auth/sessions.server'
import type { Route } from './+types/dashboard'

export async function loader({ request }: Route.LoaderArgs) {
  const session = await cookieSessionStorage.getSession(
    request.headers.get('Cookie')
  )
  const customerId = (session.get('customerId') as string | undefined) ?? null

  return {
    customerId,
  }
}
export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { customerId } = loaderData
  return (
    <>
      <h1>Dashboard: </h1>
      {customerId}
    </>
  )
}
