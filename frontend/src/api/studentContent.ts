/**
 * Actionable Revision Flow: Student content APIs for practice sessions.
 * Topic data comes from dashboard; practice pages fetch content separately.
 */
import api from "../services/api";

export type TopicFlashcard = {
  id: string;
  front: string;
  back: string;
  tags?: string[];
};

export type TopicFlashcardsResponse = {
  cards: TopicFlashcard[];
  topicKey: string;
  message?: string;
};

export async function getTopicFlashcards(params: {
  topicKey: string;
  specKey?: string;
}): Promise<TopicFlashcardsResponse> {
  const search = new URLSearchParams();
  search.set("topicKey", params.topicKey);
  if (params.specKey) search.set("specKey", params.specKey);
  const res = await api.get<TopicFlashcardsResponse>(
    `/student/content/topic-flashcards?${search.toString()}`
  );
  return res.data;
}
