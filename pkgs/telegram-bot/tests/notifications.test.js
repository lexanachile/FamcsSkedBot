import assert from "node:assert/strict";
import { notificationChunks, processNotifications } from "../src/notifications.js";

const header = "Изменения в расписании курса 3, группы 1:";
const text = `${header}\n\nПонедельник\n\nБыло:\n13.15–14.40\nДП <2> & моделирование\nИванов\n439 ауд.\n\nСтало:\n13.15–14.40\nДП-2\nПетров\n438 ауд.`;
const [message] = notificationChunks(text);
assert.equal(message.parse_mode, "HTML");
assert.ok(message.text.includes("<b>Понедельник</b>"));
assert.ok(message.text.includes("Было:\n<blockquote>13.15–14.40"));
assert.ok(message.text.includes("ДП &lt;2&gt; &amp; моделирование"));
assert.ok(message.text.includes("439 ауд.</blockquote>"));
const long = notificationChunks(`${text}\n\nДобавление:\n${"<&😀".repeat(5000)}`);
assert.ok(long.length > 1);
for (const chunk of long) {
  assert.ok(chunk.text.length <= 4000);
  assert.equal((chunk.text.match(/<blockquote>/g) || []).length, (chunk.text.match(/<\/blockquote>/g) || []).length);
  assert.ok(!chunk.text.includes("\uFFFD"));
}
assert.deepEqual(notificationChunks("Старое уведомление"), [{ text: "Старое уведомление" }]);
let ack = 0;
let retry = 0;
const sent = [];
globalThis.fetch = async (_url, options) => {
  sent.push(JSON.parse(options.body));
  return { ok: true, json: async () => ({ ok: true }) };
};
await processNotifications({ messages: [{ body: { chat_id: "test", text }, ack: () => ack++, retry: () => retry++ }] }, { TELEGRAM_BOT_TOKEN: "test" });
assert.equal(ack, 1);
assert.equal(retry, 0);
assert.equal(sent[0].parse_mode, "HTML");
assert.equal(sent[0].text, message.text);
console.log("Notification formatting and delivery checks passed");
