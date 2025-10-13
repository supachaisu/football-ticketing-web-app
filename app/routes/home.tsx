import { redirect } from 'react-router'

export async function loader() {
  return redirect('/login')
}

export default function Home() {
  return null
}
