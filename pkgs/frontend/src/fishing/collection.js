export function ownerLine(item) {
  const shown = (item.usernames || []).slice(0, 5).map(username => username ? `@${username}` : 'Рыбак без тега');
  if (!shown.length) return `Есть у ${item.owners || 0} рыбаков`;
  const rest = Math.max(0, (item.owners || 0) - shown.length);
  return `Есть у ${shown.join(', ')}${rest ? ` + ${rest} рыбаков` : ''}`;
}
