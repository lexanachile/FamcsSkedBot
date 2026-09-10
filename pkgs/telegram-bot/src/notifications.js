import { telegramRequest } from "./telegram.js";

const escapeHtml = text => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const labels = /^(Было|Стало|Добавление|Удаление|Смена аудитории|Замена преподавателя|Корректировка названия):$/;
const days = /^(Понедельник|Вторник|Среда|Четверг|Пятница|Суббота|Воскресенье|День \d+)$/;

export function notificationChunks(text) {
  if (!text.startsWith("Изменения в расписании курса ")) {
    return (text.match(/[\s\S]{1,4000}/gu) || []).map(text => ({ text }));
  }
  const chunks = [];
  let chunk = "";
  for (const paragraph of text.split("\n\n")) {
    const [title, ...lines] = paragraph.split("\n");
    const quoted = labels.test(title) && lines.length > 0;
    const content = quoted ? lines.join("\n") : paragraph;
    // Split before escaping, keeping entities, Unicode characters and tags intact.
    const pieces = content.match(/[\s\S]{1,600}/gu) || [""];
    for (const [index, piece] of pieces.entries()) {
      const escaped = escapeHtml(piece);
      const block = quoted
        ? `${index === 0 ? `${escapeHtml(title)}\n` : ""}<blockquote>${escaped}</blockquote>`
        : days.test(paragraph) ? `<b>${escaped}</b>` : escaped;
      if (chunk && chunk.length + block.length + 2 > 4000) {
        chunks.push({ text: chunk, parse_mode: "HTML" });
        chunk = "";
      }
      chunk += `${chunk ? "\n\n" : ""}${block}`;
    }
  }
  if (chunk) chunks.push({ text: chunk, parse_mode: "HTML" });
  return chunks;
}

export async function processNotifications(batch, env) {
  for (const message of batch.messages) {
    try {
      for (const chunk of notificationChunks(String(message.body?.text || ""))) {
        await telegramRequest(env.TELEGRAM_BOT_TOKEN, "sendMessage", { chat_id: message.body.chat_id, ...chunk });
      }
      message.ack();
    } catch (error) {
      console.error("Notification delivery failed", error);
      message.retry();
    }
  }
}
