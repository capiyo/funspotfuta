export type PublicDocumentMetadata = {
  title: string;
  description: string;
  canonical: string;
  structuredData: Record<string, unknown>;
};

const ORIGIN = 'https://www.funspot.co.ke';
const metadata: Record<string, Omit<PublicDocumentMetadata, 'canonical' | 'structuredData'>> = {
  '/about.html': {
    title: 'About Funspot | Football Fan Community',
    description: 'Learn about Funspot, a football fan community for match discussions, channels, fan posts, predictions and leaderboards.',
  },
  '/how-it-works.html': {
    title: 'How Funspot Works | Football Discussions and Channels',
    description: 'Learn how Funspot channels, fixture discussions, fan posts, predictions and leaderboards work.',
  },
  '/contact.html': {
    title: 'Contact Funspot',
    description: 'Contact information for Funspot, a football fan community.',
  },
  '/terms.html': {
    title: 'Terms of Use | Funspot',
    description: "Terms for using Funspot's football fan community, channels, match discussions and prediction features.",
  },
  '/privacy.html': {
    title: 'Privacy Policy | Funspot',
    description: 'How Funspot handles information, cookies and advertising technologies.',
  },
};

export function getPublicDocumentMetadata(path: string): PublicDocumentMetadata | null {
  const page = metadata[path];
  if (!page) return null;
  const canonical = ORIGIN + path;
  return {
    ...page,
    canonical,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      url: canonical,
      isPartOf: { '@type': 'WebSite', name: 'Funspot', url: ORIGIN + '/' },
    },
  };
}

function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
      <nav aria-label="Public pages" className="flex flex-wrap gap-x-5 gap-y-3">
        <a href="/about.html">About</a>
        <a href="/how-it-works.html">How it works</a>
        <a href="/contact.html">Contact</a>
        <a href="/terms.html">Terms</a>
        <a href="/privacy.html">Privacy</a>
      </nav>
      <p className="mt-5">© Funspot. A community for football fans.</p>
    </footer>
  );
}

export default function PublicDocument({ path, contactEmail }: { path: string; contactEmail: string }) {
  const page = getPublicDocumentMetadata(path);
  if (!page) {
    return <main className="mx-auto min-h-screen max-w-3xl bg-white px-6 py-16 text-slate-900"><h1>Page not found</h1></main>;
  }

  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-800">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold text-emerald-700">← Back to Funspot</a>

        {path === '/about.html' && <>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">About Funspot</h1>
          <p className="mt-5 leading-8">Funspot is a football fan community built around match discussions, football channels, fan posts, match predictions and community leaderboards. It brings football conversations together around teams, competitions and fixtures.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Football conversations</h2>
          <p className="mt-3 leading-8">Use channels and fixture discussions to follow topics that interest you, share opinions about matches and take part in community conversations.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Community participation</h2>
          <p className="mt-3 leading-8">Funspot includes fan posts, predictions and leaderboards so supporters can participate and explore community activity. Interactive features may require an account.</p>
          <p className="mt-6 leading-8">Learn <a className="text-emerald-700 underline" href="/how-it-works.html">how Funspot works</a>, read the <a className="text-emerald-700 underline" href="/terms.html">Terms</a> and <a className="text-emerald-700 underline" href="/privacy.html">Privacy Policy</a>, or visit the <a className="text-emerald-700 underline" href="/contact.html">Contact page</a>.</p>
        </>}

        {path === '/how-it-works.html' && <>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">How Funspot Works</h1>
          <p className="mt-5 leading-8">Funspot organizes football community activity around channels and fixtures, helping supporters find discussions about the teams and competitions they follow.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Follow football channels</h2>
          <p className="mt-3 leading-8">Browse channels to find communities and conversations focused on football competitions and topics.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Discuss matches</h2>
          <p className="mt-3 leading-8">Use fixture-related chats and community posts to share opinions and talk about teams and upcoming matches.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Predictions and leaderboards</h2>
          <p className="mt-3 leading-8">Funspot supports community match predictions and leaderboards. Predictions are opinions about sporting outcomes, not guarantees.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Pokes use points, not cash stakes</h2>
          <p className="mt-3 leading-8">In the current app implementation, a Poke reserves points from a user's points balance. Another user can fill an open Poke by choosing the opposing side; the feature is implemented separately from money bets and payment flows. Poke points are in-app points, and this description does not promise cash prizes or withdrawals. Check the app's current rules before participating.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Accounts and privacy</h2>
          <p className="mt-3 leading-8">Some interactive features require sign-in. Review the <a className="text-emerald-700 underline" href="/privacy.html">Privacy Policy</a> to understand how information may be handled.</p>
        </>}

        {path === '/contact.html' && <>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Contact Funspot</h1>
          <p className="mt-5 leading-8">For questions about your account, community activity, privacy or the operation of Funspot, contact the service team by email:</p>
          <p className="mt-4"><a className="font-semibold text-emerald-700 underline" href={'mailto:' + contactEmail}>{contactEmail}</a></p>
        </>}

        {path === '/terms.html' && <>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Terms of Use</h1>
          <p className="mt-5 leading-8">These terms describe basic expectations for using Funspot, a football fan community for channels, match discussions, fan posts, predictions and leaderboards. By using the service, you agree to use it lawfully and respectfully.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Community conduct</h2>
          <p className="mt-3 leading-8">Do not post unlawful, deceptive, threatening, abusive or infringing material. Do not impersonate another person, attempt to access another user's account, interfere with the service or misuse other people's personal information.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">User content</h2>
          <p className="mt-3 leading-8">You are responsible for content you submit, including posts, comments and messages. Do not share information you lack permission to publish. Public content may be visible to other users.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Predictions and points</h2>
          <p className="mt-3 leading-8">Predictions express opinions about sporting outcomes and are not guarantees. Pokes use in-app points according to the current implementation and are separate from money-bet/payment flows. Do not interpret points or predictions as a promise of cash value, winnings or withdrawals.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Availability and changes</h2>
          <p className="mt-3 leading-8">Features may change, be interrupted or be removed. We may take reasonable steps to protect the community, enforce these terms and address misuse.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Related policies</h2>
          <p className="mt-3 leading-8">See the <a className="text-emerald-700 underline" href="/privacy.html">Privacy Policy</a> for information about data and advertising technologies, and the <a className="text-emerald-700 underline" href="/contact.html">Contact page</a> for the operator contact details when provided.</p>
        </>}

        {path === '/privacy.html' && <>
          <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Privacy Policy</h1>
          <p className="mt-3 text-sm font-semibold text-slate-600">Last updated: October 24, 2026</p>
          <p className="mt-5 leading-8">This policy explains how Funspot handles information when you use the Funspot website and mobile app.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Information and account activity</h2>
          <p className="mt-3 leading-8">When you create an account or use community features, Funspot may process information you submit, such as account details, profile information, posts, comments, votes, and messages, to provide and secure those features. Do not post information you do not want other users to see in public community areas.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Cookies and similar technologies</h2>
          <p className="mt-3 leading-8">Funspot and service providers may use cookies, local storage, and similar technologies to keep the website working, remember preferences, protect accounts, measure performance, and support advertising. Browser settings can be used to control or delete cookies and stored data, although some features may then work differently.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Google advertising</h2>
          <p className="mt-3 leading-8">Funspot may use Google AdSense to display advertisements on the website and Google Mobile Ads (AdMob) to display advertisements in the Android app. Google and its advertising partners may process information such as IP address, device and browser identifiers, app or browser activity, approximate location derived from IP address, ad views and interactions, and diagnostic information to deliver and measure ads and help prevent fraud. The information processed and whether ads are personalized depends on the service, device settings, applicable law, and consent choices.</p>
          <p className="mt-3 leading-8">Learn how Google uses information from sites or apps that use its services in <a className="text-emerald-700 underline" href="https://policies.google.com/technologies/partner-sites" rel="noopener noreferrer">Google’s partner-site privacy information</a>. You can manage ad personalization through <a className="text-emerald-700 underline" href="https://myadcenter.google.com/" rel="noopener noreferrer">Google My Ad Center</a>. Where required by law or Google’s publisher policies, ads and non-essential storage must respect the applicable consent choices.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Service providers and sharing</h2>
          <p className="mt-3 leading-8">Funspot may rely on hosting, authentication, infrastructure, analytics, and advertising providers to operate the website. Those providers may process information as needed to provide their services, subject to their terms and applicable law. Funspot does not sell account passwords.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Retention and security</h2>
          <p className="mt-3 leading-8">Information is retained for as long as reasonably needed to provide features, meet legal obligations, resolve disputes, and protect the service. Reasonable safeguards are used, but no internet service can guarantee absolute security.</p>
          <h2 className="mt-8 text-xl font-semibold text-slate-950">Your choices and contact</h2>
          <p className="mt-3 leading-8">You can manage browser cookies and Google ad personalization using the controls linked above. For account-data requests or privacy questions, contact the Funspot service operator through the contact method provided in the app or on the official Funspot website.</p>
        </>}
        <PublicFooter />
      </article>
    </main>
  );
}
