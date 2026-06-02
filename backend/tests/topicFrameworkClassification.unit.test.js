const { classifyTopicFramework } = require("../services/topicFrameworkClassification");

describe("topic framework classifier", () => {
  test.each([
    ["Reflex Arc", "signal_pathway", "signal_flow_map"],
    ["Hormonal pathway", "signal_pathway", "signal_flow_map"],
    ["Photosynthesis", "molecular_process", "molecular_process_map"],
    ["Respiration", "molecular_process", "molecular_process_map"],
    ["Digestion", "molecular_process", "molecular_process_map"],
    ["Mitosis", "cellular_sequence", "cellular_stage_sequence"],
    ["Carbon cycle", "cycle_pathway", "cycle_system_map"],
    ["Plant disease", "cause_effect", "cause_effect_chain_map"],
    ["Rose black spot", "cause_effect", "cause_effect_chain_map"],
    ["Measles", "cause_effect", "cause_effect_chain_map"],
    ["Salmonella", "cause_effect", "cause_effect_chain_map"],
    ["Viral diseases", "classification", "classification_grid"],
    ["Bacterial diseases", "classification", "classification_grid"],
    ["Fungal diseases", "classification", "classification_grid"],
    ["Protist diseases", "classification", "classification_grid"],
    ["Human defence systems", "cause_effect", "cause_effect_chain_map"],
    ["Vaccination", "cause_effect", "cause_effect_chain_map"],
    ["Antibiotics and painkillers", "cause_effect", "cause_effect_chain_map"],
    ["Antibiotic resistance", "cause_effect", "cause_effect_chain_map"],
    ["Cell structure", "structure_function", "structure_label_map"],
    ["Animal cell", "structure_function", "structure_label_map"],
    ["Plant cell", "structure_function", "structure_label_map"],
    ["Eukaryotic and prokaryotic cells", "classification", "classification_grid"],
    ["Monoclonal antibodies production", "practical_method", "practical_method_flow"],
    ["Monoclonal antibodies uses", "application_comparison", "application_compare_grid"],
    ["Homeostasis", "system_flow", "physiology_system_flow_map"],
    ["Blood glucose control", "feedback_loop", "feedback_control_loop"],
    ["Thermoregulation", "feedback_loop", "feedback_control_loop"],
    ["Enzymes", "molecular_process", "molecular_process_map"],
  ])("%s -> %s / %s", (topic, framework, visualModel) => {
    const result = classifyTopicFramework({ topic, subject: "Biology" });
    expect(result.framework).toBe(framework);
    expect(result.visualModel).toBe(visualModel);
    expect(result.matchedBy).toBeTruthy();
  });

  test.each([
    ["Plant disease", "high", "disease_named_topic"],
    ["Rose black spot", "high", "disease_named_topic"],
    ["Measles", "high", "disease_named_topic"],
    ["Salmonella", "high", "disease_named_topic"],
    ["Viral diseases", "high", "disease_classification_keywords"],
    ["Bacterial diseases", "high", "disease_classification_keywords"],
    ["Fungal diseases", "high", "disease_classification_keywords"],
    ["Protist diseases", "high", "disease_classification_keywords"],
    ["Human defence systems", "high", "disease_cause_effect_keywords"],
    ["Vaccination", "high", "disease_cause_effect_keywords"],
    ["Antibiotics and painkillers", "high", "disease_cause_effect_keywords"],
    ["Antibiotic resistance", "high", "disease_cause_effect_keywords"],
  ])("disease topic %s has confidence %s (%s)", (topic, confidence, matchedBy) => {
    const result = classifyTopicFramework({ topic, subject: "Biology" });
    expect(result.confidence).toBe(confidence);
    expect(result.matchedBy).toBe(matchedBy);
  });

  describe("Organisation unit", () => {
    test.each([
      ["Organisation", "system_flow", "physiology_system_flow_map", "high", "organisation_system_flow_keywords"],
      ["Principles of organisation", "system_flow", "physiology_system_flow_map", "high", "organisation_system_flow_keywords"],
      ["Digestive system", "system_flow", "physiology_system_flow_map", "high", "organisation_system_flow_keywords"],
      ["Circulatory system", "system_flow", "physiology_system_flow_map", "high", "organisation_system_flow_keywords"],
      ["Heart", "system_flow", "physiology_system_flow_map", "high", "organisation_system_flow_keywords"],
      ["Blood vessels and blood", "structure_function", "structure_label_map", "high", "organisation_structure_keywords"],
      ["Blood vessels", "structure_function", "structure_label_map", "high", "organisation_structure_keywords"],
      ["Xylem", "structure_function", "structure_label_map", "high", "organisation_structure_keywords"],
      ["Phloem", "structure_function", "structure_label_map", "high", "organisation_structure_keywords"],
      ["Plant tissues", "structure_function", "structure_label_map", "high", "organisation_structure_keywords"],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.framework).not.toBe("molecular_process");
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );

    test("Coronary heart disease stays cause_effect (not organisation heart rule)", () => {
      const result = classifyTopicFramework({ topic: "Coronary heart disease", subject: "Biology" });
      expect(result.framework).toBe("cause_effect");
      expect(result.confidence).toBe("high");
      expect(result.matchedBy).toBe("disease_named_topic");
    });

    test.each([
      ["Cancer", "cause_effect", "cause_effect_chain_map", "high", "organisation_health_keywords"],
      ["Transport in plants", "system_flow", "physiology_system_flow_map", "high", "organisation_plant_transport_keywords"],
      ["Transpiration and stomata", "system_flow", "physiology_system_flow_map", "high", "organisation_plant_transport_keywords"],
      [
        "Required Practical: Plant transport",
        "practical_method",
        "practical_method_flow",
        "high",
        "organisation_practical_keywords",
      ],
      ["Health and disease", "cause_effect", "cause_effect_chain_map", "high", "disease_named_topic"],
      ["Non-communicable diseases", "cause_effect", "cause_effect_chain_map", "high", "disease_named_topic"],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
      }
    );

    test("Levels of organisation is not forced to Organisation system_flow", () => {
      const result = classifyTopicFramework({ topic: "Levels of organisation", subject: "Biology" });
      expect(result.matchedBy).not.toBe("organisation_system_flow_keywords");
    });
  });

  describe("Ecology unit", () => {
    test.each([
      ["Food chains", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
      ["Food webs", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
      ["Trophic levels", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
      ["Transfer of biomass", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
      ["Interdependence", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
      ["Biodiversity", "classification", "classification_grid", "high", "ecology_classification_keywords"],
      ["Adaptations", "cause_effect", "cause_effect_chain_map", "high", "ecology_cause_effect_keywords"],
      ["Deforestation", "cause_effect", "cause_effect_chain_map", "high", "ecology_cause_effect_keywords"],
      ["Global warming", "cause_effect", "cause_effect_chain_map", "high", "ecology_cause_effect_keywords"],
      ["Decomposition", "cycle_pathway", "cycle_system_map", "high", "ecology_cycle_keywords"],
      ["Nutrient cycling", "cycle_pathway", "cycle_system_map", "high", "ecology_cycle_keywords"],
      ["How materials are cycled", "cycle_pathway", "cycle_system_map", "high", "ecology_cycle_keywords"],
      ["Maintaining biodiversity", "cause_effect", "cause_effect_chain_map", "high", "ecology_cause_effect_keywords"],
      ["Pyramids of biomass", "system_flow", "physiology_system_flow_map", "high", "ecology_system_flow_keywords"],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );

    test("Inheritance Classification topic is not ecology biodiversity classification", () => {
      const result = classifyTopicFramework({ topic: "Classification", subject: "Biology" });
      expect(result.matchedBy).not.toBe("ecology_classification_keywords");
      expect(result.matchedBy).not.toBe("disease_classification_keywords");
    });
  });

  describe("Infection and Response unit (remaining)", () => {
    test.each([
      ["Communicable disease", "cause_effect", "cause_effect_chain_map", "high", "disease_named_topic"],
      [
        "Drug development",
        "practical_method",
        "practical_method_flow",
        "high",
        "infection_response_method_keywords",
      ],
      [
        "Monoclonal antibodies",
        "application_comparison",
        "application_compare_grid",
        "high",
        "mab_topic_fallback",
      ],
      [
        "Required Practical: Microbiology",
        "practical_method",
        "practical_method_flow",
        "high",
        "infection_response_practical_keywords",
      ],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );
  });

  describe("Bioenergetics unit", () => {
    test("Response to exercise -> system_flow high", () => {
      const result = classifyTopicFramework({ topic: "Response to exercise", subject: "Biology" });
      expect(result.framework).toBe("system_flow");
      expect(result.visualModel).toBe("physiology_system_flow_map");
      expect(result.confidence).toBe("high");
      expect(result.matchedBy).toBe("bioenergetics_response_keywords");
    });
  });

  describe("Cell Biology unit", () => {
    test.each([
      [
        "Eukaryotes and prokaryotes",
        "comparison",
        "comparison_grid",
        "high",
        "cell_biology_comparison_keywords",
      ],
      [
        "Cell specialisation",
        "structure_function",
        "structure_label_map",
        "high",
        "cell_biology_structure_keywords",
      ],
      [
        "Cell differentiation",
        "cellular_sequence",
        "cellular_stage_sequence",
        "high",
        "cell_biology_sequence_keywords",
      ],
      ["Microscopy", "practical_method", "practical_method_flow", "high", "cell_biology_practical_keywords"],
      [
        "Required Practical: Microscopy",
        "practical_method",
        "practical_method_flow",
        "high",
        "cell_biology_practical_keywords",
      ],
      ["Chromosomes", "structure_function", "structure_label_map", "high", "cell_biology_structure_keywords"],
      ["Stem cells", "cause_effect", "cause_effect_chain_map", "high", "cell_biology_cause_effect_keywords"],
      [
        "Transport in Cells",
        "molecular_process",
        "molecular_process_map",
        "high",
        "cell_biology_transport_keywords",
      ],
      [
        "Transport summary and applications",
        "comparison",
        "comparison_grid",
        "high",
        "cell_biology_comparison_keywords",
      ],
      [
        "Culturing microorganisms",
        "practical_method",
        "practical_method_flow",
        "high",
        "cell_biology_practical_keywords",
      ],
      [
        "Required Practical: Growth",
        "practical_method",
        "practical_method_flow",
        "high",
        "cell_biology_practical_keywords",
      ],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );
  });

  describe("Inheritance, Variation and Evolution unit", () => {
    test.each([
      [
        "Sexual and asexual reproduction",
        "comparison",
        "comparison_grid",
        "high",
        "inheritance_evolution_comparison_keywords",
      ],
      [
        "DNA and the genome",
        "structure_function",
        "structure_label_map",
        "high",
        "inheritance_evolution_structure_keywords",
      ],
      [
        "Genetic inheritance",
        "inheritance_model",
        "inheritance_flow_map",
        "high",
        "inheritance_evolution_inheritance_keywords",
      ],
      [
        "Inherited disorders",
        "cause_effect",
        "cause_effect_chain_map",
        "high",
        "inheritance_evolution_cause_effect_keywords",
      ],
      ["Variation", "classification", "classification_grid", "high", "inheritance_evolution_classification_keywords"],
      ["Evolution", "cause_effect", "cause_effect_chain_map", "high", "inheritance_evolution_cause_effect_keywords"],
      [
        "Evidence for evolution",
        "data_interpretation",
        "evidence_comparison_grid",
        "high",
        "inheritance_evolution_evidence_keywords",
      ],
      [
        "Fossils",
        "sequence_pathway",
        "timeline_sequence_map",
        "high",
        "inheritance_evolution_sequence_keywords",
      ],
      ["Extinction", "cause_effect", "cause_effect_chain_map", "high", "inheritance_evolution_cause_effect_keywords"],
      [
        "Resistant bacteria",
        "cause_effect",
        "cause_effect_chain_map",
        "high",
        "inheritance_evolution_cause_effect_keywords",
      ],
      [
        "Classification",
        "classification",
        "classification_grid",
        "high",
        "inheritance_evolution_classification_keywords",
      ],
      [
        "Understanding of genetics",
        "structure_function",
        "structure_label_map",
        "high",
        "inheritance_evolution_structure_keywords",
      ],
      [
        "Speciation",
        "sequence_pathway",
        "timeline_sequence_map",
        "high",
        "inheritance_evolution_sequence_keywords",
      ],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );
  });

  describe("Homeostasis and Response unit", () => {
    test.each([
      [
        "Required Practical: Reaction time",
        "practical_method",
        "practical_method_flow",
        "high",
        "homeostasis_response_practical_keywords",
      ],
      ["The brain", "structure_function", "structure_label_map", "high", "homeostasis_response_structure_keywords"],
      ["The eye", "structure_function", "structure_label_map", "high", "homeostasis_response_structure_keywords"],
      [
        "Control of body temperature",
        "feedback_loop",
        "feedback_control_loop",
        "high",
        "homeostasis_feedback_keywords",
      ],
      [
        "Human endocrine system",
        "system_flow",
        "physiology_system_flow_map",
        "high",
        "homeostasis_response_system_flow_keywords",
      ],
      ["Diabetes", "feedback_loop", "feedback_control_loop", "high", "homeostasis_feedback_keywords"],
      [
        "Maintaining water and nitrogen balance",
        "feedback_loop",
        "feedback_control_loop",
        "high",
        "homeostasis_feedback_keywords",
      ],
      [
        "Hormones in human reproduction",
        "signal_pathway",
        "signal_flow_map",
        "high",
        "homeostasis_response_signal_keywords",
      ],
      [
        "Contraception",
        "application_comparison",
        "application_compare_grid",
        "high",
        "homeostasis_response_application_keywords",
      ],
      [
        "Uses of hormones to treat infertility",
        "application_comparison",
        "application_compare_grid",
        "high",
        "homeostasis_response_application_keywords",
      ],
      ["Plant hormones", "signal_pathway", "signal_flow_map", "high", "homeostasis_response_signal_keywords"],
      [
        "Uses of plant hormones",
        "application_comparison",
        "application_compare_grid",
        "high",
        "homeostasis_response_application_keywords",
      ],
      [
        "Required Practical: Plant growth",
        "practical_method",
        "practical_method_flow",
        "high",
        "homeostasis_response_practical_keywords",
      ],
      ["Negative feedback", "feedback_loop", "feedback_control_loop", "high", "homeostasis_feedback_keywords"],
    ])(
      "%s -> %s / %s (%s, %s)",
      (topic, framework, visualModel, confidence, matchedBy) => {
        const result = classifyTopicFramework({ topic, subject: "Biology" });
        expect(result.framework).toBe(framework);
        expect(result.visualModel).toBe(visualModel);
        expect(result.confidence).toBe(confidence);
        expect(result.matchedBy).toBe(matchedBy);
        expect(result.matchedBy).not.toBe("biology_subject_fallback");
      }
    );
  });
});

