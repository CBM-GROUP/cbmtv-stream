export function getPlaybackId(url: string): string | null {
  if (!url) {
    return null;
  }
  try {
    const urlObject = new URL(url);
    if (!urlObject.hostname.includes("mux.com")) {
      return null;
    }
    const pathname = urlObject.pathname;
    const playbackId = pathname.split("/")[1].split(".")[0];
    return playbackId;
  } catch (error) {
    console.error("Error extracting playback ID:", error);
    return null;
  }
}
