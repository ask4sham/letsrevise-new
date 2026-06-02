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
      expect(result.matchedBy).toBe("disease_topic_fallback");
    });

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
    });
  });
});

