export const telegramMethod = (token, method) => `https://api.telegram.org/bot${token}/${method}`;

export async function telegramRequest(token, method, body) {
  const response = await fetch(telegramMethod(token, method), {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    console.error("Telegram API error:", response.status, text);
    throw new Error(`Telegram API error ${response.status}`);
  }
  return response.json();
}
