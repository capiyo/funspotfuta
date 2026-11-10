import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider, dehydrate } from '@tanstack/react-query';
import { getAllFixtures, queryKeys, isDemoMemberName, type Fixture } from '@funspot/core';
import App from './App';
import PublicDocument, { getPublicDocumentMetadata, getPublicDocumentRoutes } from './screens/PublicDocument';
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

type FixtureComment = { username?: string; userName?: string; user_name?: string; comment?: string; text?: string };
type FixtureWithComments = Fixture & { comments?: FixtureComment[]; latestComments?: FixtureComment[] };

/**
 * Fixture API responses have accumulated several generations of nested public
 * preview fields. Strip demo identities recursively instead of relying on a
 * short allow-list of today's voter/comment properties. This keeps new nested
 * preview fields from accidentally publishing seeded accounts during SSR.
 */
function sanitizePublicText(value: string): string {
  // Handles can appear as @mentions inside otherwise legitimate comment text,
  // not only as a standalone username property. Remove those references before
  // any public fixture value is dehydrated or rendered.
  return value.replace(
    /(^|[^A-Za-z0-9_])@?(guest_john|mary_ochieng)(?=$|[^A-Za-z0-9_])/gi,
    '$1Fan',
  );
}

function sanitizePublicValue(value: unknown): unknown {
  if (typeof value === 'string') return isDemoMemberName(value) ? undefined : sanitizePublicText(value);
  if (value instanceof Date || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(sanitizePublicValue).filter((item) => item !== undefined);
  }

  const record = value as Record<string, unknown>;
  const username = record.username ?? record.userName ?? record.user_name;
  if (isDemoMemberName(username)) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const next = sanitizePublicValue(item);
    if (next !== undefined) sanitized[key] = next;
  }
  return sanitized;
}

function sanitizePublicFixture(fixture: Fixture): Fixture {
  const sanitized = sanitizePublicValue(fixture) as Fixture;
  const extended = sanitized as FixtureWithComments;
  const keepComment = (comment: FixtureComment) => {
    const text = (comment.comment ?? comment.text ?? '').trim();
    return text.length > 0 && !PLACEHOLDER_COMMENT_TEXT.has(text);
  };
  return {
    ...sanitized,
    voters: (sanitized.voters ?? []).filter((voter) => !isDemoMemberName(voter.userName)),
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

  const renderedMarkup = renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={location}>
        <App initialAuthState={{ isInitialized: true }} />
      </StaticRouter>
    </QueryClientProvider>,
  );
  // Last-line public-output guard: a future component or API field must not
  // reintroduce seeded demo handles into crawler-visible HTML.
  const markup = sanitizePublicText(renderedMarkup);
  const queryState = sanitizePublicText(JSON.stringify(encodeQueryState(dehydrate(queryClient))))
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  return { markup, queryState };
}

export function renderNotFound(): string {
  return renderToString(<NotFoundPage />);
}

export async function renderPublicDocument(path: string, contactEmail: string): Promise<{ markup: string; liveFixture: null }> {
  return {
    markup: renderToString(<PublicDocument path={path} contactEmail={contactEmail} />),
    liveFixture: null,
  };
}

export { getPublicDocumentMetadata, getPublicDocumentRoutes };
