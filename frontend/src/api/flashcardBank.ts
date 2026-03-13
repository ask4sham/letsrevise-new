/**
 * PR-F1: Flashcard Bank API — topic-level bank (GET, import, copy-to-lesson).
 */
import api from "../services/api";

export type BankCard = {
  front: string;
  back: string;
  tags?: string[];
};

export type FlashcardBankResponse = {
  cards: BankCard[];
  topicKey: string;
  topicName?: string;
};

export async function getFlashcardBank(topicKey: string): Promise<FlashcardBankResponse> {
  const { data } = await api.get<FlashcardBankResponse>("/flashcard-bank", {
    params: { topicKey },
  });
  return data;
}

export async function importFlashcards(
  topicKey: string,
  topicName: string,
  cards: BankCard[]
): Promise<{ ok: boolean; cardsCount: number; topicKey: string }> {
  const { data } = await api.post<{ ok: boolean; cardsCount: number; topicKey: string }>(
    "/flashcard-bank/import",
    { topicKey, topicName, cards }
  );
  return data;
}

export async function copyBankToLesson(
  topicKey: string,
  lessonId: string,
  force?: boolean
): Promise<{ ok: boolean; copied: number; message?: string }> {
  const { data } = await api.post<{ ok: boolean; copied: number; message?: string }>(
    `/flashcard-bank/${encodeURIComponent(topicKey)}/copy-to-lesson/${encodeURIComponent(lessonId)}`,
    {},
    { params: force ? { force: 1 } : undefined }
  );
  return data;
}
