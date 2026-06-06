import { redirect } from 'next/navigation'
import { DEMO_PROJECT_ID } from '@/lib/demo-project'

export default function HomePage() {
  redirect(`/project/${DEMO_PROJECT_ID}/workspace`)
}
