import { createShortLink } from "@/lib/shortlinks/create"

const URL_REGEX = /https?:\/\/[^\s]+/g

export async function replaceLinksInBody(body: string, recipientId: string, campaignId: string): Promise<string> {
  const matches = body.match(URL_REGEX)
  if (!matches || matches.length === 0) return body

  let result = body
  for (const url of matches) {
    const { fullUrl } = await createShortLink({ destinationUrl: url, campaignId, recipientId })
    result = result.replace(url, fullUrl)
  }
  return result
}
