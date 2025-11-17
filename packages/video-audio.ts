import ytdlp from "yt-dlp-exec";

export async function downloadAudio(url: string, output: string) {
  console.log(`Downloading audio → ${output}`);

  await ytdlp(url, {
    extractAudio: true,
    audioFormat: "mp3",
    output,
  });

  console.log(`Audio saved as ${output}`);
}

export async function downloadVideo(url: string, quality: string, output: string) {
  console.log(`Downloading video (${quality}) → ${output}`);

  const qualityMap: Record<string, string> = {
    "1080p": "bestvideo[height=1080]+bestaudio/best",
    "720p":  "bestvideo[height=720]+bestaudio/best",
    "480p":  "bestvideo[height=480]+bestaudio/best",
    "360p":  "bestvideo[height=360]+bestaudio/best",
    "best":  "bestvideo+bestaudio/best",
  };

  const format = qualityMap[quality] || qualityMap["best"];

  await ytdlp(url, {
    format,
    mergeOutputFormat: "mp4",
    output,
  });

  console.log(`Video saved as ${output}`);
}

export async function handleYouTubeCLI(args: string[]) {

  const url = args[0];
  const mode = args[1];
  const output = args[2] || "output.mp4";

  if (!url || !mode) {
    console.error("Usage:");
    console.error("youtube <url> audio <filename.mp3>");
    console.error("youtube <url> video <filename.mp4>");
    console.error("youtube <url> 1080p <filename.mp4>");
    process.exit(1);
  }

  if (mode === "audio") {
    return downloadAudio(url, output);
  }

  if (["video", "1080p", "720p", "480p", "360p", "best"].includes(mode)) {
    return downloadVideo(url, mode, output);
  }

  console.error("Invalid mode:", mode);
  process.exit(1);
}
