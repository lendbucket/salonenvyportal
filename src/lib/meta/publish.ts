const GRAPH_API = "https://graph.facebook.com/v21.0"

interface MetaCredentials {
  fbPageId: string | undefined
  fbAccessToken: string | undefined
  igUserId: string | undefined
}

export function getMetaCredentials(locationId: string): MetaCredentials {
  const isCC = locationId === "CC" || locationId === "LTJSA6QR1HGW6"
  return {
    fbPageId: isCC ? process.env.META_CC_PAGE_ID : process.env.META_SA_PAGE_ID,
    fbAccessToken: isCC ? process.env.META_CC_PAGE_ACCESS_TOKEN : process.env.META_SA_PAGE_ACCESS_TOKEN,
    igUserId: isCC ? process.env.META_CC_INSTAGRAM_ID : process.env.META_SA_INSTAGRAM_ID,
  }
}

export async function publishToFacebookPage(params: {
  pageId: string
  accessToken: string
  message: string
  imageUrls?: string[]
}): Promise<{ id: string }> {
  const { pageId, accessToken, message, imageUrls = [] } = params

  if (imageUrls.length === 0) {
    const r = await fetch(`${GRAPH_API}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, access_token: accessToken }),
    })
    const d = await r.json()
    if (d.error) throw new Error(`FB API error: ${d.error.message}`)
    return { id: d.id }
  }

  if (imageUrls.length === 1) {
    const r = await fetch(`${GRAPH_API}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: imageUrls[0], caption: message, access_token: accessToken }),
    })
    const d = await r.json()
    if (d.error) throw new Error(`FB API error: ${d.error.message}`)
    return { id: d.post_id || d.id }
  }

  // Multi-image: upload unpublished photos, then create post with attached_media
  const mediaIds: { media_fbid: string }[] = []
  for (const url of imageUrls) {
    const r = await fetch(`${GRAPH_API}/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, published: false, access_token: accessToken }),
    })
    const d = await r.json()
    if (d.error) throw new Error(`FB photo upload error: ${d.error.message}`)
    if (d.id) mediaIds.push({ media_fbid: d.id })
  }

  const r = await fetch(`${GRAPH_API}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, attached_media: mediaIds, access_token: accessToken }),
  })
  const d = await r.json()
  if (d.error) throw new Error(`FB multi-photo post error: ${d.error.message}`)
  return { id: d.id }
}

export async function publishToInstagram(params: {
  igUserId: string
  accessToken: string
  caption: string
  imageUrls: string[]
}): Promise<{ id: string }> {
  const { igUserId, accessToken, caption, imageUrls } = params

  if (imageUrls.length === 0) {
    throw new Error("Instagram requires at least one image")
  }

  if (imageUrls.length === 1) {
    // Single image: create container then publish
    const cr = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrls[0], caption, access_token: accessToken }),
    })
    const cd = await cr.json()
    if (cd.error) throw new Error(`IG container error: ${cd.error.message}`)

    const pr = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: cd.id, access_token: accessToken }),
    })
    const pd = await pr.json()
    if (pd.error) throw new Error(`IG publish error: ${pd.error.message}`)
    return { id: pd.id }
  }

  // Carousel: create children, then carousel container, then publish
  const childIds: string[] = []
  for (const url of imageUrls) {
    const r = await fetch(`${GRAPH_API}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url, is_carousel_item: true, access_token: accessToken }),
    })
    const d = await r.json()
    if (d.error) throw new Error(`IG carousel item error: ${d.error.message}`)
    if (d.id) childIds.push(d.id)
  }

  const cr = await fetch(`${GRAPH_API}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "CAROUSEL", caption, children: childIds.join(","), access_token: accessToken }),
  })
  const cd = await cr.json()
  if (cd.error) throw new Error(`IG carousel container error: ${cd.error.message}`)

  const pr = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: cd.id, access_token: accessToken }),
  })
  const pd = await pr.json()
  if (pd.error) throw new Error(`IG carousel publish error: ${pd.error.message}`)
  return { id: pd.id }
}
