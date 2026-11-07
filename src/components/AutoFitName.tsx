type AutoFitNameProps = { name: string; maxSize?: number };

/** Keep the full player name visible in narrow four-player score tables. */
export default function AutoFitName({ name, maxSize = 14 }: AutoFitNameProps) {
  const characters = Array.from(name).length;
  const fontSize = Math.max(9, Math.min(maxSize, Math.floor(64 / Math.max(characters, 1))));

  return (
    <span
      title={name}
      className="block w-full min-w-0 text-center font-semibold leading-tight [overflow-wrap:anywhere]"
      style={{ fontSize: `${fontSize}px` }}
    >
      {name}
    </span>
  );
}
