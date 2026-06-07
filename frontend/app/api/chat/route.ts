export async function POST() {
  return Response.json(
    {
      error: 'legacy_chat_disabled',
      message:
        'Use /api/pipeline/generate for hardware generation or /api/chat/intent for follow-up intent classification.',
    },
    { status: 410 }
  )
}
