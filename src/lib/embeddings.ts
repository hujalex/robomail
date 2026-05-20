import { env, pipeline } from "@xenova/transformers";

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

let extractorPromise: ReturnType<typeof pipeline> | null = null;

const getExtractor = () => {
  if (!extractorPromise) {
    if (process.env.TRANSFORMERS_CACHE) {
      env.cacheDir = process.env.TRANSFORMERS_CACHE;
    }
    const modelId = process.env.TRANSFORMERS_MODEL ?? DEFAULT_MODEL;
    extractorPromise = pipeline("feature-extraction", modelId, {
      quantized: true,
    });
  }
  return extractorPromise;
};

export const embeddingsEnabled = (): boolean =>
  process.env.EMBEDDINGS_ENABLED !== "false";

export const createEmbedding = async (input: string): Promise<number[]> => {
  const extractor = await getExtractor();
  const output = await (extractor as (input: string, options: { pooling: "mean" }) => Promise<unknown>)(
    input,
    { pooling: "mean" },
  );
  if (!output || typeof output !== "object" || !("data" in output)) {
    throw new Error("Transformers.js embedding output missing data");
  }
  const data = (output as { data: Float32Array }).data;
  if (!data || data.length === 0) {
    throw new Error("Transformers.js embedding output missing data");
  }
  const values = Array.from(data);
  const norm =
    values.reduce((sum, value) => sum + value * value, 0) ** 0.5 || 1;
  return values.map((value) => value / norm);
};
