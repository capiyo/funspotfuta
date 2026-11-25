/*
 * Read-only Funspot article-data volume report.
 * Run privately: mongosh "$MONGODB_URI" tools/article-data-report.mongodb.js
 * Only aggregate reads are performed. No usernames, phone numbers or messages
 * are selected or returned; this script never writes to the database.
 */
const fixtureSources = [
  { name: 'games', historical: false }, { name: 'fixtures', historical: false },
  { name: 'games_history', historical: true }, { name: 'fixtures_history', historical: true }
];
function asDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
const fixturesById = new Map();
for (const source of fixtureSources) {
  const rows = db.getCollection(source.name).aggregate([{
    $project: {
      _id: 0,
      matchId: { $ifNull: ['$matchId', { $ifNull: ['$match_id', { $ifNull: ['$fixture_id', '$fixtureId'] }] }] },
      homeTeam: { $ifNull: ['$homeTeam', '$home_team'] },
      awayTeam: { $ifNull: ['$awayTeam', '$away_team'] },
      league: 1,
      kickoffUtc: { $ifNull: ['$kickoffUtc', { $ifNull: ['$dateIso', { $ifNull: ['$date_iso', '$date'] }] }] },
      status: 1, result: 1,
      homeScore: { $ifNull: ['$homeScore', '$home_score'] },
      awayScore: { $ifNull: ['$awayScore', '$away_score'] },
      completedAt: { $ifNull: ['$completedAt', '$completed_at'] }
    }
  }]).toArray();
  for (const row of rows) {
    if (typeof row.matchId !== 'string' || !row.matchId) continue;
    const old = fixturesById.get(row.matchId);
    if (!old || source.historical) fixturesById.set(row.matchId, { ...row, sourceCollection: source.name, isHistorical: source.historical });
  }
}
const voteStats = db.getCollection('votes').aggregate([
  { $match: { fixture_id: { $type: 'string', $ne: '' }, user_id: { $type: 'string', $ne: '' } } },
  { $group: {
    _id: '$fixture_id', voteRecords: { $sum: 1 }, participantIds: { $addToSet: '$user_id' },
    firstVoteAt: { $min: '$voted_at' }, lastVoteAt: { $max: '$voted_at' },
    correctVoteRecords: { $sum: { $cond: [{ $eq: ['$is_correct', true] }, 1, 0] } },
    incorrectVoteRecords: { $sum: { $cond: [{ $eq: ['$is_correct', false] }, 1, 0] } }
  } },
  { $project: {
    _id: 0, fixtureId: '$_id', voteRecords: 1,
    participantCount: { $size: '$participantIds' }, firstVoteAt: 1, lastVoteAt: 1,
    correctVoteRecords: 1, incorrectVoteRecords: 1
  } }
]).toArray();
function hasSettledResult(fixture) {
  if (!fixture) return false;
  const status = String(fixture.status || '').toLowerCase();
  const finalStatus = /^(ft|finished|completed|complete|ended|full.?time|final)$/i.test(status);
  const hasResult = typeof fixture.result === 'string' && fixture.result.trim().length > 0;
  const completed = asDate(fixture.completedAt) !== null;
  const hasScores = fixture.homeScore != null && fixture.awayScore != null
    && (fixture.isHistorical || finalStatus || completed || hasResult);
  return finalStatus || hasResult || completed || hasScores;
}
const participationPerFixture = voteStats.map((vote) => {
  const fixture = fixturesById.get(vote.fixtureId) || null;
  const kickoff = fixture ? asDate(fixture.kickoffUtc) : null;
  return {
    fixtureId: vote.fixtureId, league: fixture?.league ?? null,
    homeTeam: fixture?.homeTeam ?? null, awayTeam: fixture?.awayTeam ?? null,
    fixtureDate: kickoff?.toISOString() ?? null, sourceCollection: fixture?.sourceCollection ?? null,
    voteRecords: vote.voteRecords, distinctParticipants: vote.participantCount,
    settledResultAvailable: hasSettledResult(fixture),
    firstVoteAt: asDate(vote.firstVoteAt)?.toISOString() ?? null,
    lastVoteAt: asDate(vote.lastVoteAt)?.toISOString() ?? null,
    correctVoteRecords: vote.correctVoteRecords, incorrectVoteRecords: vote.incorrectVoteRecords
  };
}).sort((a, b) => (a.fixtureDate || '').localeCompare(b.fixtureDate || ''));
const fixtureDates = participationPerFixture.map((row) => row.fixtureDate).filter(Boolean).sort();
const voteDates = participationPerFixture.flatMap((row) => [row.firstVoteAt, row.lastVoteAt]).filter(Boolean).sort();
const participantCounts = participationPerFixture.map((row) => row.distinctParticipants);
const totalVoteRecords = participationPerFixture.reduce((sum, row) => sum + row.voteRecords, 0);
printjson({
  database: db.getName(), generatedAt: new Date().toISOString(),
  summary: {
    fixtureDocumentsCatalogued: fixturesById.size,
    distinctFixturesWithVotes: participationPerFixture.length,
    fixturesWithVotesAndSettledResults: participationPerFixture.filter((row) => row.settledResultAvailable).length,
    totalVoteRecords,
    averageDistinctParticipantsPerFixture: participantCounts.length
      ? Number((participantCounts.reduce((sum, n) => sum + n, 0) / participantCounts.length).toFixed(2)) : 0,
    maximumDistinctParticipantsPerFixture: participantCounts.length ? Math.max(...participantCounts) : 0,
    fixtureDateRange: fixtureDates.length ? { earliest: fixtureDates[0], latest: fixtureDates[fixtureDates.length - 1] } : null,
    voteDateRange: voteDates.length ? { earliest: voteDates[0], latest: voteDates[voteDates.length - 1] } : null
  },
  participationPerFixture
});
