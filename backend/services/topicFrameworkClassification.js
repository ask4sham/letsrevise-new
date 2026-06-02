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
 *     "process_sequence",
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
 *     "process_sequence_map",
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
  if (/(blood glucose|thermoregulation|temperature regulation|osmoregulation)/i.test(hay)) {
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

  // Disease / infection: classification (pathogen types) vs cause-effect chains.
  const isDiseaseTopic =
    /(plant disease|rose black spot|measles|salmonella|viral diseases?|bacterial diseases?|fungal diseases?|protist diseases?|human defen[cs]e|vaccination|antibiotic|painkiller|pathogen|disease|infection)/i.test(
      hay
    );
  if (isDiseaseTopic) {
    const isClassificationFocus =
      /(viral diseases?|bacterial diseases?|fungal diseases?|protist diseases?|pathogen types?|types of (disease|pathogen|pathogens)|classification)/i.test(
        hay
      ) ||
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
    if (/(plant disease|rose black spot|measles|salmonella)/i.test(hay)) {
      out.framework = "cause_effect";
      out.visualModel = "cause_effect_chain_map";
      out.confidence = "high";
      out.matchedBy = "disease_named_topic";
      return out;
    }
    out.framework = "cause_effect";
    out.visualModel = "cause_effect_chain_map";
    out.confidence = "medium";
    out.matchedBy = "disease_topic_fallback";
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
    out.confidence = "medium";
    out.matchedBy = "mab_topic_fallback";
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

