/**
 * PR-019: Conversations controller — threaded tutoring chat.
 */
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const ConversationMessage = require("../models/ConversationMessage");

function getUserId(req) {
  return req.user?._id || req.user?.userId || req.user?.id;
}

function isAdmin(req) {
  const t = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
  return t === "admin" || req.user?.isAdmin === true;
}

/**
 * POST /api/conversations
 * Body: { specKey, topicKey, lessonId? }
 * Returns: { conversationId }
 */
async function createConversation(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { specKey, topicKey, lessonId } = req.body || {};
    const spec = specKey != null ? String(specKey).trim() : "";
    if (!spec) {
      return res.status(400).json({ error: "specKey is required" });
    }

    const role = (req.user?.userType || req.user?.role || "").toString().toLowerCase();
    const validRole = ["student", "teacher", "admin"].includes(role) ? role : "teacher";

    const doc = await Conversation.create({
      userId,
      role: validRole,
      specKey: spec,
      topicKey: topicKey != null ? String(topicKey).trim() || null : null,
      lessonId: lessonId || null,
    });

    return res.status(201).json({ conversationId: doc._id.toString() });
  } catch (err) {
    console.error("createConversation error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * GET /api/conversations/:id
 * Returns conversation + messages with pagination.
 * Query: ?limit=20 (default 20, max 100), ?before=<ISO|timestamp>
 */
async function getConversation(req, res) {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Valid conversation id required" });
    }

    const conv = await Conversation.findById(id).lean();
    if (!conv) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const userId = getUserId(req);
    const convUserId = String(conv.userId || "");
    const reqUserId = String(userId || "");
    if (convUserId !== reqUserId && !isAdmin(req)) {
      return res.status(403).json({ error: "Not authorized to view this conversation" });
    }

    const { limit = 20, before } = req.query || {};
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const query = { conversationId: id };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const messagesDesc = await ConversationMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(lim + 1)
      .lean()
      .select("role text createdAt enquiryLogId");

    const hasMore = messagesDesc.length > lim;
    const slice = hasMore ? messagesDesc.slice(0, lim) : messagesDesc;
    const oldestReturned = slice.length > 0 ? slice[slice.length - 1].createdAt : null;

    const messagesChronological = slice.reverse().map((m) => ({
      role: m.role,
      text: m.text,
      createdAt: m.createdAt,
      enquiryLogId: m.enquiryLogId ? m.enquiryLogId.toString() : null,
    }));

    return res.json({
      conversationId: conv._id.toString(),
      specKey: conv.specKey,
      topicKey: conv.topicKey,
      lessonId: conv.lessonId ? conv.lessonId.toString() : null,
      messages: messagesChronological,
      pagination: {
        limit: lim,
        hasMore,
        oldestReturnedAt: oldestReturned ? oldestReturned.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("getConversation error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

/**
 * GET /api/conversations?specKey=...&topicKey=...&limit=20&mineOnly=true
 * Returns recent conversations. mineOnly=true (default): user's own only.
 */
async function listConversations(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { specKey, topicKey, lessonId, limit = 20, mineOnly } = req.query || {};
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const mine = mineOnly !== "false" && mineOnly !== "0";

    const filter = mine ? { userId: String(userId) } : {};
    if (specKey && String(specKey).trim()) filter.specKey = String(specKey).trim();
    if (topicKey && String(topicKey).trim()) filter.topicKey = String(topicKey).trim();
    if (lessonId && String(lessonId).trim()) filter.lessonId = String(lessonId).trim();

    const sortField = "lastMessageAt";
    const convs = await Conversation.find(filter)
      .sort({
        [sortField]: -1,
        updatedAt: -1,
      })
      .limit(lim)
      .lean()
      .select("_id title specKey topicKey lessonId createdAt updatedAt lastMessageAt");

    return res.json({
      conversations: convs.map((c) => ({
        conversationId: c._id.toString(),
        title: (c.title || "").trim() || "New chat",
        lastMessageAt: c.lastMessageAt ? c.lastMessageAt.toISOString() : null,
        specKey: c.specKey,
        topicKey: c.topicKey,
        lessonId: c.lessonId ? c.lessonId.toString() : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    console.error("listConversations error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}

module.exports = { createConversation, getConversation, listConversations };
