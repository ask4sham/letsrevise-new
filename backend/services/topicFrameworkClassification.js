/**
 * Topic framework classifier (read-only telemetry layer).
 *
 * IMPORTANT:
 * - Does not alter generation prompts, block types, routing, or Teacher Brain behaviour.
 * - Used only for metadata/log output to validate framework detection accuracy.
 */

function safeStr(v) {
  return v === undefined || v === null ? "" : String(v).trim();
}

/**
 * @param {{ topic?: string, topicKey?: string, subject?: string }} input
 * @returns {{
 *   topic: string,
 *   topicKey: string,
 *   framework:
 *     "signal_pathway" |
 *     "molecular_process" |
 *     "cycle_pathway" |
 *     "cellular_sequence" |
 *     "system_flow" |
 *     "classification" |
 *     "cause_effect" |
 *     "practical_method" |
 *     "application_comparison" |
 *     "structure_function" |
 *     "feedback_loop" |
 *     "process_sequence" |
 *     "comparison" |
 *     "inheritance_model" |
 *     "sequence_pathway" |
 *     "data_interpretation",
 *   visualModel:
 *     "signal_flow_map" |
 *     "molecular_process_map" |
 *     "cycle_system_map" |
 *     "cellular_stage_sequence" |
 *     "physiology_system_flow_map" |
 *     "classification_grid" |
 *     "cause_effect_chain_map" |
 *     "practical_method_flow" |
 *     "application_compare_grid" |
 *     "structure_label_map" |
 *     "organelle_function_map" |
 *     "feedback_control_loop" |
 *     "process_sequence_map" |
 *     "comparison_grid" |
 *     "inheritance_flow_map" |
 *     "timeline_sequence_map" |
 *     "evidence_comparison_grid",
 *   confidence: "high" | "medium",
 *   matchedBy: string
 * }}
 */
function classifyTopicFramework(input = {}) {
  const topic = safeStr(input.topic);
  const topicKey = safeStr(input.topicKey);
  const subject = safeStr(input.subject).toLowerCase();
  const hay = `${topic} ${topicKey}`.toLowerCase();

  const out = {
    topic,
    topicKey,
    framework: "process_sequence",
    visualModel: "process_sequence_map",
    confidence: "medium",
    matchedBy: "default",
  };

  // Homeostasis topics should be loop/system models unless explicitly signaling-focused.
  if (
    /(blood glucose|thermoregulation|temperature regulation|osmoregulation|control of body temperature|diabetes|negative feedback|water and nitrogen|nitrogen balance)/i.test(
      hay
    )
  ) {
    out.framework = "feedback_loop";
    out.visualModel = "feedback_control_loop";
    out.confidence = "high";
    out.matchedBy = "homeostasis_feedback_keywords";
    return out;
  }
  if (/homeostasis/i.test(hay)) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "homeostasis_system_keywords";
    return out;
  }

  // Inheritance, Variation and Evolution unit (before generic disease/classification rules).
  if (/sexual and asexual reproduction/i.test(hay)) {
    out.framework = "comparison";
    out.visualModel = "comparison_grid";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_comparison_keywords";
    return out;
  }
  if (/genetic inheritance/i.test(hay)) {
    out.framework = "inheritance_model";
    out.visualModel = "inheritance_flow_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_inheritance_keywords";
    return out;
  }
  if (/evidence for evolution/i.test(hay)) {
    out.framework = "data_interpretation";
    out.visualModel = "evidence_comparison_grid";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_evidence_keywords";
    return out;
  }
  if (/\bfossils?\b/i.test(hay)) {
    out.framework = "sequence_pathway";
    out.visualModel = "timeline_sequence_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_sequence_keywords";
    return out;
  }
  if (/(dna and the genome|understanding of genetics)/i.test(hay)) {
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_structure_keywords";
    return out;
  }
  if (/^variation$/i.test(topic)) {
    out.framework = "classification";
    out.visualModel = "classification_grid";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_classification_keywords";
    return out;
  }
  if (/^classification$/i.test(topic)) {
    out.framework = "classification";
    out.visualModel = "classification_grid";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_classification_keywords";
    return out;
  }
  if (/(inherited disorders|extinction|resistant bacteria)/i.test(hay)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_cause_effect_keywords";
    return out;
  }
  if (/\bevolution\b/i.test(hay)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_cause_effect_keywords";
    return out;
  }
  if (/speciation/i.test(hay)) {
    out.framework = "sequence_pathway";
    out.visualModel = "timeline_sequence_map";
    out.confidence = "high";
    out.matchedBy = "inheritance_evolution_sequence_keywords";
    return out;
  }

  // Disease / infection: classification (pathogen types) vs cause-effect chains.
  const isDiseaseTopic =
    /(plant disease|rose black spot|measles|salmonella|viral diseases?|bacterial diseases?|fungal diseases?|protist diseases?|human defen[cs]e|vaccination|antibiotic|painkiller|pathogen|disease|infection)/i.test(
      hay
    );
  if (isDiseaseTopic) {
    const isClassificationFocus =
      /(viral diseases?|bacterial diseases?|fungal diseases?|protist diseases?|pathogen types?|types of (disease|pathogen|pathogens))/i.test(
        hay
      ) ||
      (/classification/i.test(hay) && /(disease|pathogen)/i.test(hay)) ||
      /(type|types)\s+of\s+(disease|pathogen|pathogens)/i.test(hay) ||
      /(disease|pathogen|pathogens)\s+(type|types)/i.test(hay);
    if (isClassificationFocus) {
      out.framework = "classification";
      out.visualModel = "classification_grid";
      out.confidence = "high";
      out.matchedBy = "disease_classification_keywords";
      return out;
    }
    const isCauseEffectFocus =
      /(spread|transmission|symptoms?|prevention|prevent|treatment|treat|control|pathogen|infection|immune response|defen[cs]e|vaccination|vaccinat|antibiotics?|resistance|painkillers?)/i.test(
        hay
      );
    if (isCauseEffectFocus) {
      out.framework = "cause_effect";
      out.visualModel = "cause_effect_chain_map";
      out.confidence = "high";
      out.matchedBy = "disease_cause_effect_keywords";
      return out;
    }
    if (
      /(plant disease|rose black spot|measles|salmonella|communicable disease|coronary heart disease|health and disease|non-communicable diseases)/i.test(
        hay
      )
    ) {
      out.framework = "cause_effect";
      out.visualModel = "cause_effect_chain_map";
      out.confidence = "high";
      out.matchedBy = "disease_named_topic";
      return out;
    }
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "disease_topic_fallback";
    return out;
  }

  // Infection and Response unit: drug development, microbiology practical.
  if (/required practical:\s*microbiology/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "infection_response_practical_keywords";
    return out;
  }
  if (/drug development/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "infection_response_method_keywords";
    return out;
  }

  // Organisation unit: organ-system flow vs tissue/vessel structure (not molecular_process fallback).
  const isOrganisationStructureTopic =
    /(plant tissues?|plant cell organisation|xylem|phloem|blood vessels?)/i.test(hay);
  const isOrganisationSystemFlowTopic =
    /(principles of organisation|digestive system|circulatory system)/i.test(hay) ||
    (/^organisation$/i.test(topic) && !/levels of organisation/i.test(hay)) ||
    (/\bheart\b/i.test(hay) && !/(coronary|heart disease)/i.test(hay));
  if (isOrganisationStructureTopic) {
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "organisation_structure_keywords";
    return out;
  }
  if (isOrganisationSystemFlowTopic) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "organisation_system_flow_keywords";
    return out;
  }
  if (/(coronary heart disease|health and disease|non-communicable diseases)/i.test(hay)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "organisation_health_keywords";
    return out;
  }
  if (/^cancer$/i.test(topic)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "organisation_health_keywords";
    return out;
  }
  if (/(transport in plants|transpiration|stomata)/i.test(hay)) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "organisation_plant_transport_keywords";
    return out;
  }
  if (/required practical:\s*plant transport/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "organisation_practical_keywords";
    return out;
  }

  // Bioenergetics: exercise-linked energy demand.
  if (/response to exercise/i.test(hay)) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "bioenergetics_response_keywords";
    return out;
  }

  // Cell Biology unit: practicals, transport, structure, and cell processes.
  if (/required practical:\s*(microscopy|growth)/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "cell_biology_practical_keywords";
    return out;
  }
  if (/culturing microorganisms/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "cell_biology_practical_keywords";
    return out;
  }
  if (/^microscopy$/i.test(topic)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "cell_biology_practical_keywords";
    return out;
  }
  if (/transport in cells/i.test(hay)) {
    out.framework = "molecular_process";
    out.visualModel = "molecular_process_map";
    out.confidence = "high";
    out.matchedBy = "cell_biology_transport_keywords";
    return out;
  }
  if (/transport summary/i.test(hay)) {
    out.framework = "comparison";
    out.visualModel = "comparison_grid";
    out.confidence = "high";
    out.matchedBy = "cell_biology_comparison_keywords";
    return out;
  }
  if (/eukaryotes and prokaryotes/i.test(hay)) {
    out.framework = "comparison";
    out.visualModel = "comparison_grid";
    out.confidence = "high";
    out.matchedBy = "cell_biology_comparison_keywords";
    return out;
  }
  if (/cell specialisation/i.test(hay)) {
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "cell_biology_structure_keywords";
    return out;
  }
  if (/cell differentiation/i.test(hay)) {
    out.framework = "cellular_sequence";
    out.visualModel = "cellular_stage_sequence";
    out.confidence = "high";
    out.matchedBy = "cell_biology_sequence_keywords";
    return out;
  }
  if (/chromosomes/i.test(hay)) {
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "cell_biology_structure_keywords";
    return out;
  }
  if (/stem cells/i.test(hay)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "cell_biology_cause_effect_keywords";
    return out;
  }

  // Cell structure should not be molecular_process.
  if (/(cell structure|animal cell|plant cell|eukaryotic|prokaryotic|organelle|organelles)/i.test(hay)) {
    if (/(eukaryotic|prokaryotic|compare|difference|different types)/i.test(hay)) {
      out.framework = "classification";
      out.visualModel = "classification_grid";
      out.confidence = "high";
      out.matchedBy = "cell_classification_keywords";
      return out;
    }
    if (/(function|role|what does|does .* do|organelle)/i.test(hay)) {
      out.framework = "structure_function";
      out.visualModel = "organelle_function_map";
      out.confidence = "high";
      out.matchedBy = "cell_structure_function_keywords";
      return out;
    }
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "cell_structure_keywords";
    return out;
  }

  // Monoclonal antibodies: method vs uses vs mechanism.
  if (/(monoclonal antibodies?|mabs?)/i.test(hay)) {
    if (/(production|produce|making|method|steps?|stage|manufacture|hybridoma)/i.test(hay)) {
      out.framework = "practical_method";
      out.visualModel = "practical_method_flow";
      out.confidence = "high";
      out.matchedBy = "mab_method_keywords";
      return out;
    }
    if (/(uses|use|applications?|diagnosis|pregnancy test|therapy|treatment)/i.test(hay)) {
      out.framework = "application_comparison";
      out.visualModel = "application_compare_grid";
      out.confidence = "high";
      out.matchedBy = "mab_application_keywords";
      return out;
    }
    if (/(mechanism|bind|binding|antigen|immune)/i.test(hay)) {
      out.framework = "molecular_process";
      out.visualModel = "molecular_process_map";
      out.confidence = "high";
      out.matchedBy = "mab_mechanism_keywords";
      return out;
    }
    out.framework = "application_comparison";
    out.visualModel = "application_compare_grid";
    out.confidence = "high";
    out.matchedBy = "mab_topic_fallback";
    return out;
  }

  // Ecology unit: explicit titles before keyword heuristics (avoids biology_subject_fallback).
  if (/required practical:\s*(ecosystems|decay)/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "ecology_practical_keywords";
    return out;
  }
  if (/^levels of organisation$/i.test(topic)) {
    out.framework = "classification";
    out.visualModel = "classification_grid";
    out.confidence = "high";
    out.matchedBy = "ecology_levels_organisation_keywords";
    return out;
  }
  if (/^ecology$/i.test(topic)) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "ecology_topic_keywords";
    return out;
  }
  if (
    /(impact of environmental change|land use|waste management|factors affecting food security|sustainable fisheries)/i.test(
      hay
    )
  ) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "ecology_environmental_cause_effect_keywords";
    return out;
  }
  if (/(farming techniques|role of biotechnology)/i.test(hay)) {
    out.framework = "application_comparison";
    out.visualModel = "application_compare_grid";
    out.confidence = "high";
    out.matchedBy = "ecology_application_keywords";
    return out;
  }

  // Ecology unit: ecosystem flows, cycles, classification, and environmental cause-effect.
  if (/\bbiodiversity\b/i.test(hay) && !/maintaining biodiversity/i.test(hay)) {
    out.framework = "classification";
    out.visualModel = "classification_grid";
    out.confidence = "high";
    out.matchedBy = "ecology_classification_keywords";
    return out;
  }
  if (/(adaptations?|deforestation|global warming|maintaining biodiversity)/i.test(hay)) {
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "high";
    out.matchedBy = "ecology_cause_effect_keywords";
    return out;
  }
  if (/(decomposition|nutrient cycling|materials are cycled|how materials are cycled)/i.test(hay)) {
    out.framework = "cycle_pathway";
    out.visualModel = "cycle_system_map";
    out.confidence = "high";
    out.matchedBy = "ecology_cycle_keywords";
    return out;
  }
  if (
    /(food chains?|food webs?|trophic levels?|transfer of biomass|interdependence|pyramids of biomass)/i.test(
      hay
    )
  ) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "ecology_system_flow_keywords";
    return out;
  }

  // Homeostasis and Response unit: practicals, structure, hormones, and endocrine system flow.
  if (/required practical:\s*(reaction time|plant growth)/i.test(hay)) {
    out.framework = "practical_method";
    out.visualModel = "practical_method_flow";
    out.confidence = "high";
    out.matchedBy = "homeostasis_response_practical_keywords";
    return out;
  }
  if (/(contraception|uses of hormones to treat infertility|uses of plant hormones)/i.test(hay)) {
    out.framework = "application_comparison";
    out.visualModel = "application_compare_grid";
    out.confidence = "high";
    out.matchedBy = "homeostasis_response_application_keywords";
    return out;
  }
  if (/\b(the brain|the eye)\b/i.test(hay)) {
    out.framework = "structure_function";
    out.visualModel = "structure_label_map";
    out.confidence = "high";
    out.matchedBy = "homeostasis_response_structure_keywords";
    return out;
  }
  if (/human endocrine system/i.test(hay)) {
    out.framework = "system_flow";
    out.visualModel = "physiology_system_flow_map";
    out.confidence = "high";
    out.matchedBy = "homeostasis_response_system_flow_keywords";
    return out;
  }
  if (
    /(hormones in human reproduction|plant hormones)/i.test(hay) &&
    !/uses of (plant )?hormones/i.test(hay)
  ) {
    out.framework = "signal_pathway";
    out.visualModel = "signal_flow_map";
    out.confidence = "high";
    out.matchedBy = "homeostasis_response_signal_keywords";
    return out;
  }

  if (
    /(reflex|nervous|neurone|neuron|synapse|hormonal pathway|hormone signalling|endocrine pathway)/i.test(
      hay
    )
  ) {
    out.framework = "signal_pathway";
    out.visualModel = "signal_flow_map";
    out.confidence = "high";
    out.matchedBy = "signal_keywords";
    return out;
  }

  if (/(carbon cycle|nitrogen cycle|water cycle|sulfur cycle|^carbon-cycle$|cycle)/i.test(hay)) {
    out.framework = "cycle_pathway";
    out.visualModel = "cycle_system_map";
    out.confidence = "high";
    out.matchedBy = "cycle_keywords";
    return out;
  }

  if (/(mitosis|meiosis|cell cycle|cell division)/i.test(hay)) {
    out.framework = "cellular_sequence";
    out.visualModel = "cellular_stage_sequence";
    out.confidence = "high";
    out.matchedBy = "cellular_sequence_keywords";
    return out;
  }

  if (
    /(photosynthesis|respiration|digestion|enzyme|metabolism|glycolysis|diffusion|osmosis|active transport)/i.test(
      hay
    )
  ) {
    out.framework = "molecular_process";
    out.visualModel = "molecular_process_map";
    out.confidence = "high";
    out.matchedBy = "molecular_process_keywords";
    return out;
  }

  if (subject.includes("biology")) {
    out.framework = "molecular_process";
    out.visualModel = "molecular_process_map";
    out.confidence = "medium";
    out.matchedBy = "biology_subject_fallback";
  }

  return out;
}

module.exports = {
  classifyTopicFramework,
};

