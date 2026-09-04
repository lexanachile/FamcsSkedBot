export const manifestKey = (course: number) => `schedule:course:${course}:manifest`;
export const versionPrefix = (version: string, course: number) => `schedule:v:${version}:course:${course}`;
export const bundleKey = (version: string, course: number) => `${versionPrefix(version, course)}:bundle`;
export const groupsKey = (version: string, course: number) => `${versionPrefix(version, course)}:groups`;
export const groupKey = (version: string, course: number, group: string) =>
  `${versionPrefix(version, course)}:group:${encodeURIComponent(group)}`;
