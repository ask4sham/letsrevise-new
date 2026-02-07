// routes/assessmentPapers.ts
import { Router } from "express";
import AssessmentPaper from "../models/AssessmentPaper";

const router = Router();

router.get("/", async (req, res) => {
  try {
    // Only fetch fields we want students to see
    const papers = await AssessmentPaper.find({ published: true })
      .select("title durationSeconds mode questions") // fetch questions only to count them
      .lean();

    const response = papers.map((p) => ({
      _id: p._id,
      title: p.title,
      durationSeconds: p.durationSeconds,
      mode: p.mode,
      questionCount: Array.isArray(p.questions) ? p.questions.length : 0,
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: "Failed to load assessment papers" });
  }
});

export default router;
