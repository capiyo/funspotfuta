import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { getAllFixtures, queryKeys, resolveFixtureIsLive, isDemoMemberName, type Fixture } from '@funspot/core';
import App from './App';
import PublicDocument, { getPublicDocumentMetadata, getPublicDocumentRoutes, type PublicMatchPreviewFixture } from './screens/PublicDocument';
import { NotFoundPage } from './screens/PublicHome';

function encodeQueryState(value: unknown): unknown {
  if (value instanceof Date) return { __funspotSerializedDate: value.toISOString() };
  if (Array.isArray(value)) return value.map(encodeQueryState);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeQueryState(item)]));
  }
  return value;
}

const PLACEHOLDER_COMMENT_TEXT = new Set([
  'This is going to be a banger',
  'My gut says an upset today',
  'Defense has to show up this time',
  "Can't wait for kickoff",
  'That midfield battle decides it',
  'Home crowd advantage all day',
  'Not confident about this one honestly',
  'Easy three points incoming',
  'Injuries could really hurt them here',
  'Give me a 2-1 all day',
]);

type FixtureComment = { username?: string; userName?: string; comment?: string; text?: string };
type FixtureWithComments = Fixture & { comments?: FixtureComment[]; latestComments?: FixtureComment[] };

function sanitizePublicFixture(fixture: Fixture): Fixture {
  const extended = fixture as FixtureWithComments;
  const keepComment = (comment: FixtureComment) => {
    const text = (comment.comment ?? comment.text ?? '').trim();
    return text.length > 0 && !PLACEHOLDER_COMMENT_TEXT.has(text);
  };
  return {
    ...fixture,
    voters: (fixture.voters ?? []).filter((voter) => !isDemoMemberName(voter.userName)),
    ...(Array.isArray(extended.comments) ? { comments: extended.comments.filter(keepComment) } : {}),
    ...(Array.isArray(extended.latestComments) ? { latestComments: extended.latestComments.filter(keepComment) } : {}),
  };
}

export type ServerRenderedApp = { markup: string; queryState: string };

export async function renderApp(location = '/', prefetchPublicData = true): Promise<ServerRenderedApp> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (prefetchPublicData) {
    // Public SSR includes only the real fixture feed. Channel members and
    // user-generated feed posts remain client-loaded so seeded/demo accounts
    // and private user content can never become crawlable homepage HTML.
    const prefetch = Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.fixtures(),
        queryFn: async ({ signal }) => (await getAllFixtures(signal)).map(sanitizePublicFixture),
        staleTime: 60_000,
      }),
    ]);

    let deadline: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      prefetch,
      new Promise<void>((resolve) => {
        deadline = setTimeout(() => {
          void queryClient.cancelQueries().finally(resolve);
        }, 2200);
      }),
    ]);
    if (deadline) clearTimeout(deadline);
  }

  const markup = renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={location}>
        <App initialAuthState={{ isInitialized: true }} />
      </StaticRouter>
    </QueryClientProvider>,
  );
  const queryState = JSON.stringify(encodeQueryState(dehydrate(queryClient)))
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  return { markup, queryState };
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

export async function renderPublicDocument(path: string, contactEmail: string): Promise<{ markup: string; liveFixture: PublicMatchPreviewFixture | null }> {
  let liveFixture: PublicMatchPreviewFixture | null = null;
  if (path === '/insights/match-preview-template') {
    const controller = new AbortController();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const fixtures = await Promise.race([
        getAllFixtures(controller.signal),
        new Promise<Fixture[] | null>((resolve) => {
          deadline = setTimeout(() => resolve(null), 1600);
        }),
      ]);
      const fixture = fixtures?.find((candidate) => resolveFixtureIsLive(candidate.status, candidate.isLive));
      liveFixture = fixture ? {
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        league: fixture.league,
        status: fixture.status,
        homeScore: fixture.homeScore,
        awayScore: fixture.awayScore,
        date: fixture.date,
        time: fixture.time,
        isLive: fixture.isLive,
      } : null;
    } catch {
      liveFixture = null;
    } finally {
      if (deadline) clearTimeout(deadline);
      controller.abort();
    }
  }
  return {
    markup: renderToString(<PublicDocument path={path} contactEmail={contactEmail} liveFixture={liveFixture} />),
    liveFixture,
  };
}

export { getPublicDocumentMetadata, getPublicDocumentRoutes };
