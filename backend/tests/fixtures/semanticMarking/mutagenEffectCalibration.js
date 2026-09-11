/**
 * Forensic-corrected expectations for mutagen effect calibration cases (not production content).
 */
module.exports = {
  question: "Give two examples of mutagens and explain their effect on mutation rate.",
  marks: 3,
  markScheme: [
    "One mutagen is named, for example gamma rays, X-rays, ultraviolet (UV) radiation, or chemicals in tobacco smoke.",
    "A second different mutagen is named from the same set: gamma rays, X-rays, ultraviolet (UV) radiation, or chemicals in tobacco smoke.",
    "Mutagens increase the rate of mutation by causing changes to the DNA base sequence in genes.",
  ],
  cases: [
    {
      id: "GX-UV",
      answer:
        "Gamma rays and X-rays are mutagens. Mutagens increase the rate of mutations occurring in DNA.",
      expectedScore: 2,
    },
    {
      id: "GAMMA-DUP",
      answer:
        "Gamma rays and gamma rays are mutagens. Mutagens increase the rate of mutations occurring in DNA.",
      expectedScore: 1,
    },
    {
      id: "ONE-EFFECT",
      answer: "X-rays are a mutagen. Mutagens increase the rate of mutations occurring in DNA.",
      expectedScore: 1,
    },
  ],
};
