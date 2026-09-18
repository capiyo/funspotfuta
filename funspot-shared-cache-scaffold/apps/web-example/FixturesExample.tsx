import { useFixtures } from '@funspot/core';

/**
 * This exact file (or a near-identical one swapping <div>/<Text> for
 * RN's View/Text) works the same on web and mobile — that's the payoff
 * of putting useFixtures() in packages/core instead of inside each app.
 */
export function FixturesExample() {
  const { data: fixtures, isLoading, error, refetch } = useFixtures();

  if (isLoading) return <p>Loading fixtures…</p>;
  if (error) return <p>Failed to load fixtures.</p>;

  return (
    <ul>
      {fixtures?.map((f) => (
        <li key={f.id}>
          {f.matchId ?? f.id} — {f.status}
          {f.isLive && ` (LIVE ${f.timeElapsed}')`}
        </li>
      ))}
    </ul>
  );
}
