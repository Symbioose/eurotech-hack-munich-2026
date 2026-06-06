const TAVILY_SEARCH_URL = 'https://api.tavily.com/search'

function normalizeResult(result) {
  return {
    title: result.title ?? '',
    url: result.url ?? '',
    content: result.content ?? '',
    score: typeof result.score === 'number' ? result.score : null,
    raw_content: result.raw_content ?? null,
  }
}

export async function tavilySearch({
  query,
  allowed_domains = [],
  max_results = 5,
  search_depth = 'basic',
  include_raw_content = false,
}) {
  const apiKey = process.env.TAVILY_API_KEY
  const base = {
    provider: 'tavily',
    query,
    allowed_domains,
    max_results,
    search_depth,
  }

  if (!apiKey) {
    return {
      ...base,
      status: 'not_configured',
      results: [],
      answer: null,
      limitation: 'TAVILY_API_KEY is not configured, so no live web research was run.',
    }
  }

  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      include_domains: allowed_domains,
      max_results,
      search_depth,
      include_answer: false,
      include_raw_content,
    }),
  })

  if (!response.ok) {
    return {
      ...base,
      status: 'error',
      results: [],
      answer: null,
      limitation: `Tavily request failed with HTTP ${response.status}.`,
    }
  }

  const body = await response.json()
  return {
    ...base,
    status: 'ok',
    results: (body.results ?? []).map(normalizeResult),
    answer: body.answer ?? null,
    limitation: null,
  }
}

export function candidateUpdatePolicy(kind) {
  if (kind === 'compliance') {
    return 'Live findings are candidate, source-cited and human-reviewable before they become trusted compliance rules.'
  }
  if (kind === 'hardware') {
    return 'Live findings are candidate component updates; availability/spec data must be validated against distributor or datasheet sources before catalog promotion.'
  }
  return 'Live findings are candidate source updates; MCP expert stores decide whether to trust and persist them.'
}
