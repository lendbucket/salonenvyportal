export type ParsedVideo = {
  platform: "youtube" | "instagram" | "tiktok" | "facebook" | "unknown"
  videoId: string
  embedUrl: string
  thumbnailUrl?: string
  isValid: boolean
}

export function parseVideoUrl(url: string): ParsedVideo {
  const invalid: ParsedVideo = { platform: "unknown", videoId: "", embedUrl: "", isValid: false }

  try {
    const u = new URL(url)

    // YouTube: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId = ""
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1)
      } else if (u.searchParams.get("v")) {
        videoId = u.searchParams.get("v")!
      } else if (u.pathname.includes("/shorts/")) {
        videoId = u.pathname.split("/shorts/")[1]
      }
      videoId = videoId.split("&")[0].split("?")[0]
      if (!videoId) return invalid
      return {
        platform: "youtube",
        videoId,
        embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&showinfo=0&iv_load_policy=3&controls=1&color=white&fs=1&playsinline=1`,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        isValid: true,
      }
    }

    // Instagram: instagram.com/reel/CODE, instagram.com/p/CODE
    if (u.hostname.includes("instagram.com")) {
      const match = u.pathname.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/)
      if (!match) return invalid
      const videoId = match[2]
      return {
        platform: "instagram",
        videoId,
        embedUrl: `https://www.instagram.com/${match[1]}/${videoId}/embed/`,
        isValid: true,
      }
    }

    // TikTok: tiktok.com/@user/video/ID, vm.tiktok.com/ID
    if (u.hostname.includes("tiktok.com")) {
      const match = u.pathname.match(/\/video\/(\d+)/)
      const videoId = match ? match[1] : u.pathname.split("/").pop() || ""
      if (!videoId) return invalid
      return {
        platform: "tiktok",
        videoId,
        embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
        isValid: true,
      }
    }

    // Facebook: facebook.com/watch/?v=ID, facebook.com/.../videos/ID
    if (u.hostname.includes("facebook.com")) {
      let videoId = u.searchParams.get("v") || ""
      if (!videoId) {
        const match = u.pathname.match(/\/videos\/(\d+)/)
        if (match) videoId = match[1]
      }
      if (!videoId) return invalid
      return {
        platform: "facebook",
        videoId,
        embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=560`,
        isValid: true,
      }
    }

    return invalid
  } catch {
    return invalid
  }
}

export function getPlatformLabel(platform: string): string {
  const labels: Record<string, string> = {
    youtube: "YouTube", instagram: "Instagram", tiktok: "TikTok", facebook: "Facebook", unknown: "Unknown",
  }
  return labels[platform] || platform
}

export function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = {
    youtube: "#ff4444", instagram: "#e1306c", tiktok: "#00f2ea", facebook: "#1877f2", unknown: "#666",
  }
  return colors[platform] || "#666"
}
