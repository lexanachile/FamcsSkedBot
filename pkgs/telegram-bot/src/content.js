export const helpText = (botName) => `*Справка по ${botName}*

Доступные команды:
/start - Главное меню с кнопкой для открытия расписания
/help - Справка

Как использовать:
1. Нажмите кнопку "Открыть расписание"
2. Выберите необходимый курс и группу
3. Нажмите на нужный день
4. Получите расписание

Фидбеку по боту буду очень рад в лс @lexanachile
`;

export const buildKeyboard = (miniAppUrl) => ({ inline_keyboard: [
  [{ text: "Открыть расписание", web_app: { url: miniAppUrl } }],
  [{ text: "/help", callback_data: "help" }],
] });
