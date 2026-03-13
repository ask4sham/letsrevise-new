/**
 * Step 4 (LLM Roadmap): RAG — stored chunks of lesson content with embeddings for similarity search.
 * Indexed per lesson; used by POST /api/ai/ask to ground answers in lesson content.
 */
const mongoose = require("mongoose");

const LessonRAGChunkSchema = new mongoose.Schema(
  {
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson", required: true, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    /** OpenAI embedding vector (e.g. text-embedding-3-small → 1536 dimensions). */
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);

LessonRAGChunkSchema.index({ lessonId: 1, chunkIndex: 1 }, { unique: true });

module.exports = mongoose.models.LessonRAGChunk || mongoose.model("LessonRAGChunk", LessonRAGChunkSchema);
