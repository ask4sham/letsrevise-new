'use strict';

/**
 * PR10-compatible Lesson Synthesiser draft envelope fixture.
 * Frozen shape: source + generator + draft (main-app-safe-v1).
 */

function cloneFixture() {
  return JSON.parse(JSON.stringify(FIXTURE));
}

const FIXTURE = {
  "source": "letsrevise-lesson-synthesiser",
  "generator": "lesson-synthesiser-v1",
  "draft": {
    "title": "Gametes and fertilisation",
    "description": "By the end of this lesson, students can explain the core ideas of Gametes and fertilisation for Edexcel IGCSE.\nStudents can use required vocabulary accurately when discussing Gametes and fertilisation.",
    "subject": "Biology",
    "level": "IGCSE",
    "board": "Edexcel",
    "examBoardName": "Edexcel",
    "tier": "Higher",
    "topic": "Gametes and Fertilisation",
    "specKey": "edexcel-igcse-biology",
    "topicKey": "edexcel-igcse-biology:reproduction/gametes-fertilisation",
    "status": "draft",
    "isPublished": false,
    "metadata": {
      "generator": "lesson-synthesiser-v1",
      "schemaVersion": "0.10.0-export-compat",
      "source": "letsrevise-lesson-synthesiser",
      "criticOk": true,
      "originalTopicKey": "reproduction/gametes-fertilisation",
      "examBoardName": "Edexcel",
      "compatibility": "main-app-safe-v1"
    },
    "pages": [
      {
        "pageId": "page-1-objectives",
        "title": "Lesson objectives and prior knowledge",
        "order": 1,
        "blocks": [
          {
            "id": "block-lesson-objectives",
            "type": "text",
            "role": "objectives",
            "title": "Lesson objectives",
            "content": "By the end of this lesson, students can explain the core ideas of Gametes and fertilisation for Edexcel IGCSE.\nStudents can use required vocabulary accurately when discussing Gametes and fertilisation.",
            "items": [
              {
                "text": "By the end of this lesson, students can explain the core ideas of Gametes and fertilisation for Edexcel IGCSE.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "text": "Students can use required vocabulary accurately when discussing Gametes and fertilisation.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          },
          {
            "id": "block-prior-knowledge",
            "type": "text",
            "role": "priorKnowledge",
            "title": "Prior knowledge",
            "content": "Students should already know that living organisms reproduce to produce offspring.",
            "items": [
              {
                "text": "Students should already know that living organisms reproduce to produce offspring.",
                "sourceIds": []
              }
            ],
            "sourceIds": []
          }
        ]
      },
      {
        "pageId": "page-2-explanation",
        "title": "Teacher explanation and key ideas",
        "order": 2,
        "blocks": [
          {
            "id": "block-teacher-explanation",
            "type": "text",
            "role": "teacherExplanation",
            "title": "Teacher explanation",
            "content": "Grounded teaching point (curated_stub): Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).\nGrounded teaching point (curated_stub): Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
            "items": [
              {
                "text": "Grounded teaching point (curated_stub): Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "text": "Grounded teaching point (curated_stub): Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          },
          {
            "id": "block-key-ideas",
            "type": "keyIdea",
            "role": "keyIdeas",
            "title": "Key ideas",
            "content": "Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).\nExplain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
            "items": [
              {
                "text": "Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "text": "Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          }
        ]
      },
      {
        "pageId": "page-3-examples",
        "title": "Worked examples, misconceptions and examiner notes",
        "order": 3,
        "blocks": [
          {
            "id": "block-worked-examples",
            "type": "text",
            "role": "workedExample",
            "title": "Worked examples",
            "content": "Worked example (scaffold): walk through one IGCSE classroom scenario for Gametes and fertilisation, citing the curated sources — do not invent extra specification claims.",
            "items": [
              {
                "text": "Worked example (scaffold): walk through one IGCSE classroom scenario for Gametes and fertilisation, citing the curated sources — do not invent extra specification claims.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
            ]
          },
          {
            "id": "block-common-misconceptions",
            "type": "commonMistake",
            "role": "commonMisconceptions",
            "title": "Common misconceptions",
            "content": "Common misconception to address: Fertilisation is only the meeting of gametes, not fusion of nuclei.",
            "items": [
              {
                "text": "Common misconception to address: Fertilisation is only the meeting of gametes, not fusion of nuclei.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
            ]
          },
          {
            "id": "block-examiner-notes",
            "type": "examTip",
            "role": "examinerNotes",
            "title": "Examiner notes",
            "content": "Examiner note (scaffold): Edexcel IGCSE (Higher) answers should use precise vocabulary from the sources; curated_stub text is not official wording.\nCommand word to rehearse: describe.\nCommand word to rehearse: explain.",
            "items": [
              {
                "text": "Examiner note (scaffold): Edexcel IGCSE (Higher) answers should use precise vocabulary from the sources; curated_stub text is not official wording.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "text": "Command word to rehearse: describe.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "text": "Command word to rehearse: explain.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
            ]
          }
        ]
      },
      {
        "pageId": "page-4-image-activities",
        "title": "Image and activity prompts",
        "order": 4,
        "blocks": [
          {
            "id": "block-image-img-teach-1",
            "type": "diagram",
            "role": "teachingDiagram",
            "title": "Teaching diagram: Gametes and fertilisation",
            "content": "Create an original labelled classroom diagram explaining Gametes and fertilisation for Edexcel IGCSE. Use clear leader lines and educational labels grounded in the curated sources. Do not copy exam papers or textbook images.",
            "caption": "Create an original labelled classroom diagram explaining Gametes and fertilisation for Edexcel IGCSE. Use clear leader lines and educational labels grounded in the curated sources. Do not copy exam papers or textbook images.",
            "studentPrompt": "Create an original labelled classroom diagram explaining Gametes and fertilisation for Edexcel IGCSE. Use clear leader lines and educational labels grounded in the curated sources. Do not copy exam papers or textbook images.",
            "labelsAllowedOnStudentImage": true,
            "studentSafe": true,
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ],
            "metadata": {
              "kind": "teaching_diagram",
              "teacherBrief": "Teaching diagram may show labelled structures/processes for Gametes and fertilisation. Key vocabulary: gamete, fertilisation, haploid, diploid. Grounded in curated_stub sources only.",
              "bannedRevealTerms": [],
              "styleRules": [
                "Original flat educational diagram style",
                "Copyright-safe: do not copy exam papers or textbook images",
                "No brand logos or past-paper cloning",
                "Edexcel IGCSE (Higher) classroom-appropriate"
              ],
              "activityType": "none",
              "labelsAllowedOnStudentImage": true,
              "studentSafe": true
            }
          },
          {
            "id": "block-image-img-ret-1",
            "type": "diagram",
            "role": "retrievalImagePrompt",
            "title": "Retrieval image: Gametes and fertilisation",
            "content": "Create an original unlabelled outline diagram about Gametes and fertilisation for Edexcel IGCSE. Show blank leader lines only. Do not print answer words on the image. Do not copy exam papers or textbook images.",
            "caption": "Create an original unlabelled outline diagram about Gametes and fertilisation for Edexcel IGCSE. Show blank leader lines only. Do not print answer words on the image. Do not copy exam papers or textbook images.",
            "studentPrompt": "Create an original unlabelled outline diagram about Gametes and fertilisation for Edexcel IGCSE. Show blank leader lines only. Do not print answer words on the image. Do not copy exam papers or textbook images.",
            "labelsAllowedOnStudentImage": false,
            "studentSafe": true,
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ],
            "metadata": {
              "kind": "retrieval_image",
              "teacherBrief": "Students retrieve labels for: teacher-key:gamete; teacher-key:fertilisation; teacher-key:haploid; teacher-key:diploid. Keep answers in teacher materials only.",
              "bannedRevealTerms": [
                "gamete",
                "fertilisation",
                "haploid",
                "diploid"
              ],
              "styleRules": [
                "Original flat educational diagram style",
                "Copyright-safe: do not copy exam papers or textbook images",
                "No brand logos or past-paper cloning",
                "Edexcel IGCSE (Higher) classroom-appropriate"
              ],
              "activityType": "retrieval",
              "labelsAllowedOnStudentImage": false,
              "studentSafe": true
            }
          },
          {
            "id": "block-image-img-act-1",
            "type": "diagram",
            "role": "activityImagePrompt",
            "title": "Activity image: Gametes and fertilisation",
            "content": "Create an original activity card image for Gametes and fertilisation with empty answer boxes and unlabelled regions. Students complete labels during the activity. Keep the image free of answer text. Original style only — no exam-paper or textbook copies.",
            "caption": "Create an original activity card image for Gametes and fertilisation with empty answer boxes and unlabelled regions. Students complete labels during the activity. Keep the image free of answer text. Original style only — no exam-paper or textbook copies.",
            "studentPrompt": "Create an original activity card image for Gametes and fertilisation with empty answer boxes and unlabelled regions. Students complete labels during the activity. Keep the image free of answer text. Original style only — no exam-paper or textbook copies.",
            "labelsAllowedOnStudentImage": false,
            "studentSafe": true,
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ],
            "metadata": {
              "kind": "activity_image",
              "teacherBrief": "Activity target labels: teacher-key:gamete; teacher-key:fertilisation; teacher-key:haploid; teacher-key:diploid. Use for drag_drop or label completion after teaching.",
              "bannedRevealTerms": [
                "gamete",
                "fertilisation",
                "haploid",
                "diploid"
              ],
              "styleRules": [
                "Original flat educational diagram style",
                "Copyright-safe: do not copy exam papers or textbook images",
                "No brand logos or past-paper cloning",
                "Edexcel IGCSE (Higher) classroom-appropriate"
              ],
              "activityType": "label",
              "labelsAllowedOnStudentImage": false,
              "studentSafe": true
            }
          }
        ]
      },
      {
        "pageId": "page-5-self-check",
        "title": "Self-check questions",
        "order": 5,
        "blocks": [
          {
            "id": "block-self-check",
            "type": "selfCheck",
            "role": "selfCheck",
            "title": "Self-check",
            "questions": [
              {
                "id": "sc1",
                "type": "short",
                "purpose": "definition",
                "stem": "Define the term \"gamete\" in the context of Gametes and fertilisation for Edexcel IGCSE.",
                "prompt": "Define the term \"gamete\" in the context of Gametes and fertilisation for Edexcel IGCSE.",
                "question": "Define the term \"gamete\" in the context of Gametes and fertilisation for Edexcel IGCSE.",
                "options": [],
                "answer": "A concise definition of gamete aligned with the curated curriculum sources for Gametes and fertilisation.",
                "correctAnswer": "A concise definition of gamete aligned with the curated curriculum sources for Gametes and fertilisation.",
                "markScheme": [
                  "Award 1 mark for a clear definition of gamete linked to Gametes and fertilisation."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "id": "sc2",
                "type": "mcq",
                "purpose": "misconception",
                "stem": "Identify the inaccurate idea about Gametes and fertilisation: \"Fertilisation is only the meeting of gametes, not fusion of nuclei.\" Why is this inaccurate?",
                "prompt": "Identify the inaccurate idea about Gametes and fertilisation: \"Fertilisation is only the meeting of gametes, not fusion of nuclei.\" Why is this inaccurate?",
                "question": "Identify the inaccurate idea about Gametes and fertilisation: \"Fertilisation is only the meeting of gametes, not fusion of nuclei.\" Why is this inaccurate?",
                "options": [
                  "It contradicts the curated curriculum sources for this topic",
                  "It is always true for every organism without exception",
                  "It replaces the need for any biological evidence",
                  "It means assessment never uses command words"
                ],
                "answer": "It contradicts the curated curriculum sources for this topic",
                "correctAnswer": "It contradicts the curated curriculum sources for this topic",
                "markScheme": [
                  "Award 1 mark for recognising the misconception against the source-backed idea."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "id": "sc3",
                "type": "short",
                "purpose": "explain",
                "stem": "In one or two sentences, explain this curriculum point for Gametes and fertilisation: Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).",
                "prompt": "In one or two sentences, explain this curriculum point for Gametes and fertilisation: Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).",
                "question": "In one or two sentences, explain this curriculum point for Gametes and fertilisation: Describe gametes as specialised sex cells involved in sexual reproduction (curated stub).",
                "options": [],
                "answer": "Explanation restating the curated point without adding invented specification claims.",
                "correctAnswer": "Explanation restating the curated point without adding invented specification claims.",
                "markScheme": [
                  "Award 1 mark for explaining the grounded curriculum point clearly."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
            ]
          }
        ]
      },
      {
        "pageId": "page-6-checkpoint",
        "title": "Checkpoint questions",
        "order": 6,
        "blocks": [
          {
            "id": "block-checkpoint",
            "type": "checkpoint",
            "role": "checkpoint",
            "title": "Checkpoint",
            "questions": [
              {
                "id": "cp1",
                "type": "short",
                "purpose": "apply",
                "stem": "Apply the ideas in Gametes and fertilisation to a simple classroom example suitable for Edexcel IGCSE (Higher).",
                "prompt": "Apply the ideas in Gametes and fertilisation to a simple classroom example suitable for Edexcel IGCSE (Higher).",
                "question": "Apply the ideas in Gametes and fertilisation to a simple classroom example suitable for Edexcel IGCSE (Higher).",
                "options": [],
                "answer": "A short applied example that stays within the resolved curriculum sources.",
                "correctAnswer": "A short applied example that stays within the resolved curriculum sources.",
                "markScheme": [
                  "Award 1–2 marks for a valid application linked to the topic sources."
                ],
                "marks": 2,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              },
              {
                "id": "cp2",
                "type": "mcq",
                "purpose": "compare",
                "stem": "For Gametes and fertilisation, which comparison best reflects the curated teaching points (not official wording claims)?",
                "prompt": "For Gametes and fertilisation, which comparison best reflects the curated teaching points (not official wording claims)?",
                "question": "For Gametes and fertilisation, which comparison best reflects the curated teaching points (not official wording claims)?",
                "options": [
                  "Compare related processes using vocabulary from the topic sources",
                  "Ignore sources and invent a new specification statement",
                  "Treat GCSE and IGCSE as identical board identities",
                  "Replace biological terms with Option labels"
                ],
                "answer": "Compare related processes using vocabulary from the topic sources",
                "correctAnswer": "Compare related processes using vocabulary from the topic sources",
                "markScheme": [
                  "Award 1 mark for choosing the source-grounded comparison approach."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              },
              {
                "id": "cp3",
                "type": "short",
                "purpose": "sequence",
                "stem": "Outline a sensible teaching sequence for Gametes and fertilisation that starts from prior knowledge and ends with a short check on: Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
                "prompt": "Outline a sensible teaching sequence for Gametes and fertilisation that starts from prior knowledge and ends with a short check on: Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
                "question": "Outline a sensible teaching sequence for Gametes and fertilisation that starts from prior knowledge and ends with a short check on: Explain fertilisation as the fusion of male and female gamete nuclei (curated stub).",
                "options": [],
                "answer": "Prior knowledge → core idea → example → misconception check → brief summary.",
                "correctAnswer": "Prior knowledge → core idea → example → misconception check → brief summary.",
                "markScheme": [
                  "Award marks for a coherent sequence that references the grounded point."
                ],
                "marks": 2,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          }
        ]
      },
      {
        "pageId": "page-7-quiz",
        "title": "Quiz / revision questions",
        "order": 7,
        "blocks": [
          {
            "id": "block-page-quiz",
            "type": "pageQuiz",
            "role": "pageQuiz",
            "title": "Quiz / revision",
            "questions": [
              {
                "id": "quiz1",
                "type": "short",
                "purpose": "definition",
                "stem": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
                "prompt": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
                "question": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
                "options": [],
                "answer": "Meaning of gamete consistent with the curated sources.",
                "correctAnswer": "Meaning of gamete consistent with the curated sources.",
                "markScheme": [
                  "1 mark for accurate use of gamete."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "id": "quiz2",
                "type": "mcq",
                "purpose": "explain",
                "stem": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
                "prompt": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
                "question": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
                "options": [
                  "Describe gametes as specialised sex cells involved in sexual reproduction",
                  "An explanation that invents unassessed specification claims",
                  "An explanation that ignores board and level identity",
                  "An explanation written only as placeholder labels"
                ],
                "answer": "Describe gametes as specialised sex cells involved in sexual reproduction",
                "correctAnswer": "Describe gametes as specialised sex cells involved in sexual reproduction",
                "markScheme": [
                  "Award 1 mark for the source-consistent explanation."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "id": "quiz3",
                "type": "short",
                "purpose": "misconception",
                "stem": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
                "prompt": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
                "question": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
                "options": [],
                "answer": "Misconception: Fertilisation is only the meeting of gametes, not fusion of nuclei.. Correction grounded in curated sources.",
                "correctAnswer": "Misconception: Fertilisation is only the meeting of gametes, not fusion of nuclei.. Correction grounded in curated sources.",
                "markScheme": [
                  "1 mark for naming a misconception; 1 mark for a source-backed correction."
                ],
                "marks": 2,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
                ]
              },
              {
                "id": "quiz4",
                "type": "short",
                "purpose": "apply",
                "stem": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
                "prompt": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
                "question": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
                "options": [],
                "answer": "A brief applied task tied to the topic pack vocabulary and sources.",
                "correctAnswer": "A brief applied task tied to the topic pack vocabulary and sources.",
                "markScheme": [
                  "Award marks for a valid, source-aligned application."
                ],
                "marks": 2,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              },
              {
                "id": "quiz5",
                "type": "mcq",
                "purpose": "exam",
                "stem": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
                "prompt": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
                "question": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
                "options": [
                  "Use precise vocabulary from the sources and answer the command word",
                  "Pad answers with generic filler phrases",
                  "Collapse IGCSE identity into GCSE labels",
                  "Rely on numbered placeholder choices instead of biology"
                ],
                "answer": "Use precise vocabulary from the sources and answer the command word",
                "correctAnswer": "Use precise vocabulary from the sources and answer the command word",
                "markScheme": [
                  "Award 1 mark for the examiner-aligned habit."
                ],
                "marks": 1,
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          }
        ]
      },
      {
        "pageId": "page-8-summary",
        "title": "Summary and keywords",
        "order": 8,
        "blocks": [
          {
            "id": "block-summary",
            "type": "text",
            "role": "summary",
            "title": "Summary",
            "content": "Summary: Gametes and fertilisation for Edexcel IGCSE is grounded in the resolved curriculumSources above.",
            "items": [
              {
                "text": "Summary: Gametes and fertilisation for Edexcel IGCSE is grounded in the resolved curriculumSources above.",
                "sourceIds": [
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
                  "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
                ]
              }
            ],
            "sourceIds": [
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1",
              "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
            ]
          },
          {
            "id": "block-keywords",
            "type": "keyWords",
            "role": "keywords",
            "title": "Keywords",
            "content": "gamete, fertilisation, haploid, diploid",
            "items": [
              {
                "text": "gamete",
                "sourceIds": []
              },
              {
                "text": "fertilisation",
                "sourceIds": []
              },
              {
                "text": "haploid",
                "sourceIds": []
              },
              {
                "text": "diploid",
                "sourceIds": []
              }
            ],
            "sourceIds": []
          }
        ]
      }
    ],
    "quiz": {
      "questions": [
        {
          "id": "quiz1",
          "type": "short",
          "purpose": "definition",
          "stem": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
          "prompt": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
          "question": "State the meaning of \"gamete\" as used when teaching Gametes and fertilisation.",
          "options": [],
          "answer": "Meaning of gamete consistent with the curated sources.",
          "correctAnswer": "Meaning of gamete consistent with the curated sources.",
          "markScheme": [
            "1 mark for accurate use of gamete."
          ],
          "marks": 1,
          "sourceIds": [
            "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
          ]
        },
        {
          "id": "quiz2",
          "type": "mcq",
          "purpose": "explain",
          "stem": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
          "prompt": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
          "question": "Which explanation is most consistent with the curated sources for Gametes and fertilisation?",
          "options": [
            "Describe gametes as specialised sex cells involved in sexual reproduction",
            "An explanation that invents unassessed specification claims",
            "An explanation that ignores board and level identity",
            "An explanation written only as placeholder labels"
          ],
          "answer": "Describe gametes as specialised sex cells involved in sexual reproduction",
          "correctAnswer": "Describe gametes as specialised sex cells involved in sexual reproduction",
          "markScheme": [
            "Award 1 mark for the source-consistent explanation."
          ],
          "marks": 1,
          "sourceIds": [
            "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
          ]
        },
        {
          "id": "quiz3",
          "type": "short",
          "purpose": "misconception",
          "stem": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
          "prompt": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
          "question": "Describe one misconception learners may hold about Gametes and fertilisation and correct it using the curriculum sources.",
          "options": [],
          "answer": "Misconception: Fertilisation is only the meeting of gametes, not fusion of nuclei.. Correction grounded in curated sources.",
          "correctAnswer": "Misconception: Fertilisation is only the meeting of gametes, not fusion of nuclei.. Correction grounded in curated sources.",
          "markScheme": [
            "1 mark for naming a misconception; 1 mark for a source-backed correction."
          ],
          "marks": 2,
          "sourceIds": [
            "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF1"
          ]
        },
        {
          "id": "quiz4",
          "type": "short",
          "purpose": "apply",
          "stem": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
          "prompt": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
          "question": "Give one exam-style application of Gametes and fertilisation that a Edexcel IGCSE student could answer in under two minutes.",
          "options": [],
          "answer": "A brief applied task tied to the topic pack vocabulary and sources.",
          "correctAnswer": "A brief applied task tied to the topic pack vocabulary and sources.",
          "markScheme": [
            "Award marks for a valid, source-aligned application."
          ],
          "marks": 2,
          "sourceIds": [
            "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
          ]
        },
        {
          "id": "quiz5",
          "type": "mcq",
          "purpose": "exam",
          "stem": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
          "prompt": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
          "question": "For Edexcel IGCSE revision on Gametes and fertilisation, which habit best matches examiner expectations in this scaffold?",
          "options": [
            "Use precise vocabulary from the sources and answer the command word",
            "Pad answers with generic filler phrases",
            "Collapse IGCSE identity into GCSE labels",
            "Rely on numbered placeholder choices instead of biology"
          ],
          "answer": "Use precise vocabulary from the sources and answer the command word",
          "correctAnswer": "Use precise vocabulary from the sources and answer the command word",
          "markScheme": [
            "Award 1 mark for the examiner-aligned habit."
          ],
          "marks": 1,
          "sourceIds": [
            "edexcel-igcse-biology:reproduction/gametes-fertilisation:GF2"
          ]
        }
      ]
    }
  }
};

module.exports = {
  lessonSynthesiserPr10DraftFixture: FIXTURE,
  getLessonSynthesiserPr10DraftFixture: cloneFixture,
};
