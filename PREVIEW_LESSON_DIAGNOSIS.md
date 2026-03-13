# Preview Lesson Scroll Jump — Root Cause Diagnosis

## 1. Root Cause

**AskAiPanel** and **AskAiStudentPanel** each have a `useEffect` that runs whenever `messages` changes and calls `messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })`. This scrolls the page to bring the chat messages area into view.

On preview entry:
1. The panels mount (teacher sees AskAiPanel, student sees AskAiStudentPanel).
2. On mount, `messages = []`. The effect runs and scrolls to the empty chat area.
3. The conversation init effect runs and either loads a stored conversation (async) or creates a new one. When `loadConversation` completes, it calls `setMessages(mapped)`.
4. That triggers a second run of the messages effect — **after** the preview reset has already scrolled to top.
5. `scrollIntoView` runs again and scrolls the page down to the messages end (which is below the Quick Quiz in the layout). This overrides the preview reset.

The panels sit between the lesson content and the Quick Quiz. Scrolling to their `messagesEndRef` moves the viewport down into the quiz/practice area.

---

## 2. File + Function Causing the Jump

| File | Location | Function |
|------|----------|----------|
| `frontend/src/components/ai/AskAiPanel.tsx` | Lines 206–218 | `useEffect(() => { messagesEndRef.current?.scrollIntoView(...) }, [messages])` |
| `frontend/src/components/ai/AskAiStudentPanel.tsx` | Lines 205–218 | Same effect |

---

## 3. Why It Happens After Preview Reset

- Preview reset runs in LessonViewPage and schedules `window.scrollTo(0, 0)` in `requestAnimationFrame`.
- AskAiPanel/AskAiStudentPanel are child components; their effects run in the same pass.
- The chat panels also have async flows:
  - Stored conversation: `loadConversation` fetches messages, then `setMessages` runs **later**.
  - New conversation: `createConversation` then `setMessages([])`.
- When `messages` updates (especially after load), the effect runs again and calls `scrollIntoView` **after** the preview reset.
- That scroll happens in the panels; they are not aware of `previewLockRef` in LessonViewPage.
- Result: preview scrolls to top, then the chat scroll effect runs and scrolls the page down, so the final position is in the quiz/chat area.

---

## 4. Minimal Fix

Pass a `suppressAutoScroll` prop from LessonViewPage to both panels when in preview entry. While `suppressAutoScroll` is true, skip the `scrollIntoView` call in the messages effect.

Because the URL is cleaned and `entry=preview` is removed soon after load, keep `suppressAutoScroll` true for ~400ms via a `previewEntrySuppressScroll` state that is cleared when the preview lock is released.

---

## 5. Patch Summary

### A. AskAiPanel.tsx
- Add prop: `suppressAutoScroll?: boolean`.
- In the messages `useEffect`, return early when `suppressAutoScroll` is true.

### B. AskAiStudentPanel.tsx
- Same changes as AskAiPanel.

### C. LessonViewPage.tsx
- Add state: `previewEntrySuppressScroll` (stays true for ~400ms after preview reset).
- In the preview reset effect: set `previewEntrySuppressScroll = true` before scroll, and set it to `false` in the 400ms timeout along with releasing the lock.
- Pass `suppressAutoScroll={isPreviewEntry || previewEntrySuppressScroll}` to both AskAiPanel and AskAiStudentPanel (structured and legacy views).

### D. Dev logs (optional, remove before production)
- `[AskAiPanel] SCROLL_TRIGGER` / `[AskAiStudentPanel] SCROLL_TRIGGER` when scroll runs.
- `[AskAiPanel] suppressed scroll` / `[AskAiStudentPanel] suppressed scroll` when suppressed.
- `[LessonViewPage] PREVIEW_RESET scrollTo top` when preview reset runs.
