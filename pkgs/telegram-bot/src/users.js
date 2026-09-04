export async function upsertUser(db, from, chatId) {
  await db.prepare(`INSERT INTO bot_users (telegram_id, chat_id, course, group_name, notifications_enabled)
    VALUES (?, ?, NULL, NULL, 0)
    ON CONFLICT(telegram_id) DO UPDATE SET chat_id = excluded.chat_id, updated_at = CURRENT_TIMESTAMP`)
    .bind(String(from.id), String(chatId)).run();
}

export async function getUser(db, telegramId) {
  return db.prepare("SELECT telegram_id, chat_id, course, group_name, notifications_enabled FROM bot_users WHERE telegram_id = ?")
    .bind(String(telegramId)).first();
}

export async function setGroup(db, telegramId, course, groupName) {
  await db.prepare(`UPDATE bot_users SET course = ?, group_name = ?, notifications_enabled = 1,
    updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`)
    .bind(course, groupName, String(telegramId)).run();
}

export async function skipGroup(db, telegramId) {
  await db.prepare(`UPDATE bot_users SET course = NULL, group_name = NULL, notifications_enabled = 0,
    updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?`)
    .bind(String(telegramId)).run();
}

export async function toggleNotifications(db, telegramId) {
  await db.prepare(`UPDATE bot_users SET notifications_enabled = CASE notifications_enabled WHEN 1 THEN 0 ELSE 1 END,
    updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ? AND group_name IS NOT NULL`)
    .bind(String(telegramId)).run();
  return getUser(db, telegramId);
}
