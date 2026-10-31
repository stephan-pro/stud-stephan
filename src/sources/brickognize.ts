// Brickognize: free photo recognition. No key; the photo goes as form field `query_image`.
import { type Fetch, isRecord, list, num, str } from "./json.ts";

export const BRICKOGNIZE_URL = "https://api.brickognize.com/predict/figs/";

export interface Prediction {
  /** BrickLink number of the figure, e.g. `sw0001`. */
  id: string;
  name: string;
  /** Confidence 0–1. */
  score: number;
  imageUrl?: string;
  category?: string;
  sites: string[];
}

export function topPredictions(body: unknown, limit = 3): Prediction[] {
  if (!isRecord(body)) return [];
  const predictions = list(body.items).flatMap((entry): Prediction[] => {
    if (!isRecord(entry)) return [];
    const id = str(entry.id);
    const score = num(entry.score);
    if (!id || score === undefined) return [];
    const prediction: Prediction = {
      id,
      name: str(entry.name) ?? "(ohne Namen)",
      score,
      sites: list(entry.external_sites).flatMap((site) =>
        isRecord(site) && str(site.name) ? [String(site.name)] : [],
      ),
    };
    const imageUrl = str(entry.img_url);
    const category = str(entry.category);
    if (imageUrl) prediction.imageUrl = imageUrl;
    if (category) prediction.category = category;
    return [prediction];
  });
  return predictions.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function recognize(
  fetchFn: Fetch,
  photo: Uint8Array<ArrayBuffer>,
  fileName: string,
): Promise<Prediction[]> {
  const form = new FormData();
  form.append("query_image", new Blob([photo], { type: mimeType(fileName) }), fileName);
  const response = await fetchFn(BRICKOGNIZE_URL, { method: "POST", body: form });
  if (!response.ok) throw new Error(`Brickognize antwortet mit HTTP ${response.status}`);
  return topPredictions(await response.json());
}

function mimeType(fileName: string): string {
  return /\.png$/i.test(fileName) ? "image/png" : "image/jpeg";
}
