import type { Bindings } from "../types";

export async function enqueueChanges(env: Bindings, course: number, notifications: Record<string, unknown>) {
  const moderator = env.TEST_TELEGRAM_USER_ID?.trim();
  for (const [group, text] of Object.entries(notifications)) {
    if (typeof text !== "string" || !text.trim()) continue;
    const message = text.startsWith("Изменения в расписании курса ") ? text : `Курс ${course}\n${text}`;
    // Moderation does not depend on enrollment or the subscription switch.
    if (moderator) {
      try {
        await env.NOTIFICATIONS_QUEUE.send({ chat_id: moderator, text: message });
      } catch (error) {
        console.error("Failed to enqueue moderator notification", course, group, error);
      }
    }
    try {
      const users = await env.DB.prepare(
        "SELECT telegram_id, chat_id FROM bot_users WHERE course = ? AND group_name = ? AND notifications_enabled = 1",
      ).bind(course, group).all<{ telegram_id: string; chat_id: string }>();
      const recipients = new Set(users.results.filter(user => String(user.telegram_id) !== moderator && String(user.chat_id) !== moderator).map(user => String(user.chat_id)));
      for (const chat_id of recipients) await env.NOTIFICATIONS_QUEUE.send({ chat_id, text: message });
    } catch (error) {
      console.error("Failed to enqueue group notifications", course, group, error);
    }
  }
}
