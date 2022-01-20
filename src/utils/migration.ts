const pad = (val: number, len: number) => String(val).padStart(len, '0');

export function getNextMigrationName(currNames: string[], name: string): string {
  const cleanedName = name.toLowerCase().replace(/ /g, '_');
  let number = 0;

  for (const migration of currNames.sort().reverse()) {
    const match = migration.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{6})_(.*)\.php/);
    if (!match) continue;

    const now = new Date();

    if (
      Number.parseInt(match[1], 10) === now.getFullYear() &&
      Number.parseInt(match[2], 10) === now.getMonth() + 1 &&
      Number.parseInt(match[3], 10) === now.getDate()
    ) {
      number = Number.parseInt(match[4], 10) + 1;
      break;
    }
  }

  const now = new Date();

  return `${pad(now.getFullYear(), 4)}_${pad(now.getMonth() + 1, 2)}_${pad(now.getDate(), 2)}_${pad(number, 6)}_${cleanedName}`;
}
