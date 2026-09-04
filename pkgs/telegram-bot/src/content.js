export const helpText = (botName) => `*Справка по ${botName}*

Доступные команды:
/start - Главное меню с кнопкой для открытия расписания
/help - Справка
/settings - Настройка группы и уведомлений
/id - Показать ваш Telegram ID для тестирования уведомлений

Как использовать:
1. Нажмите кнопку "Открыть расписание"
2. Выберите необходимый курс и группу
3. Нажмите на нужный день
4. Получите расписание

Фидбеку по боту буду очень рад в лс @lexanachile
`;

export const buildKeyboard = (miniAppUrl, user) => ({ inline_keyboard: [
  [{ text: "Открыть расписание", web_app: { url: miniAppUrl } }],
  [{ text: user?.group_name ? `Курс: ${user.course} Группа: ${user.group_name}` : "Настроить группу", callback_data: "settings" }],
  [{ text: "/help", callback_data: "help" }],
] });

export const onboardingKeyboard = { inline_keyboard: [
  [{ text: "Выбрать группу", callback_data: "choose_course" }],
  [{ text: "Пропустить", callback_data: "skip_group" }],
] };

export const courseKeyboard = { inline_keyboard: [
  [1, 2, 3, 4].map((course) => ({ text: `${course} курс`, callback_data: `course:${course}` })),
  [{ text: "Отмена", callback_data: "settings" }],
] };

export const groupsKeyboard = (groups, course) => ({
  inline_keyboard: Array.from(
    { length: Math.ceil(groups.length / 4) },
    (_, row) => groups.slice(row * 4, row * 4 + 4).map((group) => ({
      text: group,
      callback_data: `group:${course}:${group}`,
    })),
  ),
});

export const settingsKeyboard = (user) => ({ inline_keyboard: [
  [{ text: "Изменить группу", callback_data: "choose_course" }],
  ...(user?.group_name ? [[{ text: user.notifications_enabled ? "Отключить уведомления" : "Включить уведомления", callback_data: "toggle_notifications" }]] : []),
  ...(user?.group_name ? [[{ text: "Удалить группу", callback_data: "skip_group" }]] : []),
] });
