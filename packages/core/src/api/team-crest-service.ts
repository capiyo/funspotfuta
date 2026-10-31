const CDN = 'https://imagecache.365scores.com/image/upload/f_png,w_96,h_96,c_limit,q_auto:eco,dpr_2/Competitors/';

export function build365ScoresCompetitorImageUrl(competitorId: number | string | null | undefined): string | null {
  const id = Number(competitorId);
  return Number.isSafeInteger(id) && id > 0 ? CDN + id : null;
}

/** 365Scores competitor IDs are supplied by the fixture scraper; never guess a club from its display name. */
export async function resolveTeamCrest(
  _teamName: string,
  _endpoint?: string,
  _country?: string,
  competitorId?: number | string | null,
): Promise<string | null> {
  return build365ScoresCompetitorImageUrl(competitorId);
}
