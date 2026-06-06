import { getFixForWarning } from './helpers'

export async function POST(req: Request) {
  const { warningId } = await req.json()
  const fix = getFixForWarning(warningId)

  if (!fix) {
    return Response.json({ error: 'Unknown warning id' }, { status: 404 })
  }

  return Response.json(fix)
}
