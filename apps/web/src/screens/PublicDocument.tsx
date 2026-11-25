import type { ReactNode } from 'react';
import { CONTACT_EMAIL } from '../config/contact-email.mjs';

export type PublicDocumentMetadata = {
  title: string;
  description: string;
  canonical: string;
  structuredData: Record<string, unknown>;
};

const ORIGIN = 'https://www.funspot.co.ke';
const pageMetadata: Record<string, { title: string; description: string }> = {
  '/about': {
    title: 'About Funspot | Football Fan Community in Kenya',
    description: 'Meet Funspot, an independent football fan community created in Nairobi for fixtures, match conversations and community predictions.',
  },
  '/contact': {
    title: 'Contact Funspot | Support and Privacy Enquiries',
    description: 'Contact the Funspot operator in Nairobi, Kenya, about accounts, community content, moderation or privacy requests.',
  },
  '/privacy': {
    title: 'Privacy Policy | Funspot',
    description: 'Read how Funspot handles account information, phone details, posts, cookies, Firebase, MongoDB and advertising technologies.',
  },
  '/terms': {
    title: 'Terms of Service | Funspot',
    description: 'Read the rules for Funspot accounts, posts, football discussions, community predictions, moderation and account termination.',
  },
  '/ads-disclosure': {
    title: 'Cookie and Ads Disclosure | Funspot',
    description: 'Learn how Funspot uses cookies, Google AdSense, DoubleClick and third-party advertising vendors, and how to manage ad preferences.',
  },
};

const aliases: Record<string, string> = {
  '/about.html': '/about',
  '/contact.html': '/contact',
  '/privacy.html': '/privacy',
  '/terms.html': '/terms',
};

function normalizePath(path: string): string {
  const clean = path.split('?')[0].replace(/\/+$/, '') || '/';
  return aliases[clean] ?? clean;
}

export function getPublicDocumentRoutes(): string[] {
  return Object.keys(pageMetadata);
}

export function getPublicDocumentMetadata(path: string): PublicDocumentMetadata | null {
  const route = normalizePath(path);
  const page = pageMetadata[route];
  if (!page) return null;
  const canonical = ORIGIN + route;
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
    <footer className="mt-14 border-t border-slate-200 pt-7 text-sm text-slate-600">
      <nav aria-label="Public pages" className="flex flex-wrap gap-x-5 gap-y-3">
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/privacy">Privacy Policy</a>
        <a href="/terms">Terms of Service</a>
        <a href="/ads-disclosure">Cookie and Ads Disclosure</a>
      </nav>
      <p className="mt-5">© Funspot. An independent football fan community based in Nairobi, Kenya.</p>
    </footer>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-white px-6 py-12 text-slate-800">
      <article className="mx-auto max-w-3xl">
        <a href="/" className="text-sm font-semibold text-emerald-700">← Back to Funspot</a>
        {children}
        <PublicFooter />
      </article>
    </main>
  );
}

function AboutPage() {
  return <PageShell>
    <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">About Funspot</h1>
    <p className="mt-5 leading-8">Funspot is an independent football fan community built to bring matchday conversations, fixtures, supporter posts, predictions and channel leaderboards into one place. It is run by an independent developer in Nairobi, Kenya. The project is made for people who enjoy following football and want to share their views with other supporters, whether they follow one club closely or watch several competitions.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">What supporters can do</h2>
    <p className="mt-3 leading-8">Members can follow fixture information, join football channels, discuss matches, publish posts and take part in community predictions. Match discussions are organised around fixtures so supporters can talk about the teams and events they are watching. Channels provide a way to gather around a shared football interest. The app also includes points and leaderboard features that make participation visible within a community.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Predictions and points</h2>
    <p className="mt-3 leading-8">A prediction is a member’s selection about a football outcome. The app records prediction activity and displays service-provided points and leaderboard information. Points are in-app participation units; they are not money, deposits, withdrawable funds or a promise of a cash prize. Pokes are also based on in-app points. Funspot does not provide real-money betting through these community prediction features. Football results are uncertain, and no prediction is guaranteed.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Independent project</h2>
    <p className="mt-3 leading-8">Funspot is an independently developed product, not an official website of a football club, league, broadcaster or governing body. Club and competition names are used to identify the subject of discussion. Fixture data may be supplied by third-party data services and can change when schedules or match statuses are updated.</p>
    <p className="mt-6 leading-8">Review the <a className="text-emerald-700 underline" href="/privacy">Privacy Policy</a> or <a className="text-emerald-700 underline" href="/contact">contact Funspot</a>.</p>
  </PageShell>;
}

function ContactPage({ email }: { email: string }) {
  return <PageShell>
    <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Contact Funspot</h1>
    <p className="mt-5 leading-8">Funspot is operated as an independent project from Nairobi, Kenya. For help with an account, a privacy request, a report about community content, a question about the service, contact the operator by email.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Support and moderation</h2>
    <p className="mt-3 leading-8">When reporting a post, include its post identifier if it is visible, the username or channel where it appeared, and a short explanation of the concern. Do not include passwords, verification codes or unnecessary sensitive information. Reports are reviewed by the service operator; sending a report does not guarantee that content will be removed, but it provides a documented route for review.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Email</h2>
    <p className="mt-3 leading-8">Write to <a className="font-semibold text-emerald-700 underline" href={'mailto:' + email}>{email}</a>. Please use a clear subject such as “Account support”, “Privacy request” or “Content report” so the message can be directed appropriately.</p>
  </PageShell>;
}

function PrivacyPage({ email }: { email: string }) {
  return <PageShell>
    <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Privacy Policy</h1>
    <p className="mt-3 text-sm font-semibold text-slate-600">Last updated: 9 November 2026</p>
    <p className="mt-5 leading-8">This policy explains how Funspot handles information when people use its website and mobile application. Funspot is an independent football community project operated from Nairobi, Kenya. The information handled depends on the features a person chooses to use, their device and settings, and applicable law.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Information collected</h2>
    <p className="mt-3 leading-8">Information may include account identifiers and authentication details, username and profile information, contact details, phone number where supplied for account or payment-related app features, profile images, posts, comments, messages, votes, Poke activity, channel membership and support correspondence. Technical information may include IP address, browser and device details, app version, diagnostic events, and records needed to protect the service. Do not place passwords, one-time verification codes or private financial credentials in posts or public profile fields.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">How information is used</h2>
    <p className="mt-3 leading-8">Information is used to create and secure accounts, display profiles and user content, deliver messages and notifications, operate channels and fixture discussions, record community predictions and points, respond to support requests, moderate harmful content, troubleshoot faults and maintain service security. Information may also be used to understand aggregate service performance and to comply with legal obligations. Funspot should use information only for purposes compatible with providing and protecting the service.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Firebase, MongoDB and service providers</h2>
    <p className="mt-3 leading-8">Funspot uses Firebase services for parts of its application infrastructure, including account authentication and related app services. The service also uses MongoDB-backed storage through its backend for application records such as accounts, channels, messages and user-generated content. Hosting, delivery, notification, analytics and security providers may process information on Funspot’s behalf. These providers operate under their own service terms and privacy documentation. Data may be processed in locations outside Kenya depending on provider infrastructure and configuration.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Cookies and local storage</h2>
    <p className="mt-3 leading-8">The website and its providers may use cookies, local storage and similar technologies to maintain sessions, remember preferences, protect accounts, measure performance, prevent fraud and support advertising. Essential storage may be needed for the site to function. Browser settings can block or clear cookies and local storage, although doing so may sign a user out or affect some features. Where consent is required, non-essential cookies and advertising storage should be controlled by the applicable consent choices.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Google AdSense, DoubleClick and advertising vendors</h2>
    <p className="mt-3 leading-8">Funspot may display website advertising through Google AdSense. Google advertising technologies may use cookies, including DoubleClick-related cookies, and similar identifiers to serve, personalise, limit, measure and report advertisements and to help detect invalid activity. Third-party advertising vendors and ad networks may also process browser or device information, IP address, ad views, interactions and related signals when they provide or measure ads. The vendors involved can vary by the advertising settings and the user's location. Advertising partners' processing is governed by their own privacy notices and applicable consent requirements.</p>
    <p className="mt-3 leading-8">People can review or change personalised advertising choices through <a className="text-emerald-700 underline" href="https://adssettings.google.com/" rel="noopener noreferrer">Google Ads Settings</a>. They can also learn about interest-based advertising choices at <a className="text-emerald-700 underline" href="https://www.aboutads.info/choices/" rel="noopener noreferrer">aboutads.info</a>. Browser controls can be used to clear or block cookies. These controls may not disable every form of contextual or non-personalised advertising.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Sharing, retention and security</h2>
    <p className="mt-3 leading-8">Information may be shared with infrastructure and service providers when necessary to operate Funspot, with authorities when required by law, or as part of a legitimate effort to investigate abuse, protect users or defend legal rights. Public posts and comments can be seen by other users. Information is retained for as long as reasonably necessary for the purposes described, including account operation, safety, dispute resolution and legal compliance. Reasonable safeguards are used, but no internet service can guarantee absolute security.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Your choices and rights</h2>
    <p className="mt-3 leading-8">Depending on applicable law, users may request access to personal information, correction of inaccurate information, deletion, restriction or objection to certain processing, and a copy of information they provided. Some records may need to be retained for security, legal or operational reasons. Users can also review or remove content they control where the app provides that option. To make a privacy request, contact <a className="text-emerald-700 underline" href={'mailto:' + email}>{email}</a> and describe the request without sending a password or verification code.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Children</h2>
    <p className="mt-3 leading-8">Funspot is not intended for children under 13, and children under 13 must not create accounts or submit personal information. If the operator becomes aware that an under-13 child has provided personal information, the operator will take reasonable steps to investigate and delete the information where appropriate. Parents or guardians who believe a child has submitted information can contact the address above.</p>
  </PageShell>;
}

function TermsPage({ email }: { email: string }) {
  return <PageShell>
    <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Terms of Service</h1>
    <p className="mt-3 text-sm font-semibold text-slate-600">Last updated: 9 November 2026</p>
    <p className="mt-5 leading-8">These terms apply to use of the Funspot website and application. Funspot is an independent football fan community operated from Nairobi, Kenya. By accessing the service, you agree to use it lawfully and in a way that respects other users and the operation of the platform. If you do not agree, do not use the service.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Accounts and security</h2>
    <p className="mt-3 leading-8">Provide accurate information where requested and keep account credentials and verification codes confidential. You are responsible for activity performed through your account, subject to applicable law. Tell the operator promptly if you believe your account has been compromised. Do not impersonate another person, create accounts to evade restrictions, interfere with authentication or attempt to access accounts or systems without permission.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">User content and community rules</h2>
    <p className="mt-3 leading-8">You remain responsible for posts, images, videos, comments, messages and other material you submit. You must have the rights and permissions needed to share that material. Do not publish unlawful content, threats, targeted harassment, hateful or discriminatory material, sexual exploitation, private personal information, spam, malware, deceptive promotions or content that infringes another person's rights. Do not use Funspot to encourage violence, commit fraud or organise unlawful activity. Respect other supporters even when discussing rival clubs or controversial decisions.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Moderation and removal</h2>
    <p className="mt-3 leading-8">Users can report concerning content through the Report action where available or by emailing <a className="text-emerald-700 underline" href={'mailto:' + email}>{email}</a>. Funspot may review reports, remove or restrict content, disable features, limit posting, suspend accounts or terminate accounts when reasonably necessary to protect users, comply with law, enforce these terms or address repeated or serious misuse. Content may also be removed when the operator receives a credible rights or privacy complaint. Moderation decisions may consider context and severity; the operator does not guarantee that every report will lead to removal.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Predictions and in-app points</h2>
    <p className="mt-3 leading-8">Predictions express opinions about sporting outcomes and are not guarantees. Points and leaderboard values are application features and have no promised cash value. Pokes use in-app points and are separate from money betting. Funspot does not offer real-money betting or gambling through its community features. Do not use the service to solicit deposits, organise betting pools, offer cash stakes or promise financial returns based on a prediction or leaderboard position.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Availability, third parties and changes</h2>
    <p className="mt-3 leading-8">Features, fixture information and third-party integrations may change, be delayed, become unavailable or be discontinued. Funspot is not responsible for the content or availability of external services that it does not control. The service is provided without a guarantee that every fixture, message or notification will be uninterrupted or error-free. The operator may update these terms and will publish the revised version on this page. Continued use after an update means you accept the revised terms to the extent permitted by law.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Suspension and termination</h2>
    <p className="mt-3 leading-8">You may stop using Funspot at any time. The operator may suspend or terminate access for serious violations, repeated harmful conduct, security risks, legal requirements or conduct that threatens the service or its users. Where practical, the operator may provide notice, but urgent safety or security concerns may require immediate action. Termination does not remove obligations that by their nature continue, including responsibility for content already shared, legal obligations and provisions concerning liability or disputes.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Contact</h2>
    <p className="mt-3 leading-8">Questions about these terms can be sent to <a className="text-emerald-700 underline" href={'mailto:' + email}>{email}</a>.</p>
  </PageShell>;
}

function AdsDisclosurePage() {
  return <PageShell>
    <h1 className="mt-8 text-3xl font-bold tracking-tight text-slate-950">Cookie and Ads Disclosure</h1>
    <p className="mt-5 leading-8">Funspot may use cookies and similar technologies to operate the website, protect sessions, remember preferences, measure site performance and support advertising. This page explains the main advertising relationships in plain language. It should be read together with the <a className="text-emerald-700 underline" href="/privacy">Privacy Policy</a>, which describes information handling more broadly.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Advertising on Funspot</h2>
    <p className="mt-3 leading-8">Website advertising may be served through Google AdSense. Google and its advertising partners may use cookies, including DoubleClick-related cookies, or other identifiers to show and measure advertisements, limit repeated impressions, detect invalid traffic and, where permitted, personalise advertising. Third-party vendors may participate in the advertising process. The vendors and technologies can vary by location, consent state and advertising settings.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Cookies and choices</h2>
    <p className="mt-3 leading-8">Cookies are small data files stored by a browser. Similar technologies include local storage and device identifiers. You can use browser settings to block or clear cookies, though sign-in and other site features may not work as expected. You can manage personalised advertising through <a className="text-emerald-700 underline" href="https://adssettings.google.com/" rel="noopener noreferrer">Google Ads Settings</a> and review industry opt-out information at <a className="text-emerald-700 underline" href="https://www.aboutads.info/choices/" rel="noopener noreferrer">aboutads.info</a>. Opt-out tools may affect interest-based advertising without eliminating contextual ads or all measurement technologies.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Advertising independence</h2>
    <p className="mt-3 leading-8">Advertising does not determine the outcome of community predictions or the information presented by Funspot. An advertisement is a paid placement supplied by an advertising system, not an endorsement by Funspot of every product or claim in the advertisement. Users should assess advertisers independently and avoid sharing passwords, verification codes or payment credentials in response to unsolicited promotions.</p>
    <h2 className="mt-8 text-xl font-semibold text-slate-950">Questions</h2>
    <p className="mt-3 leading-8">For questions about advertising or privacy, contact Funspot through the <a className="text-emerald-700 underline" href="/contact">Contact page</a>. See the <a className="text-emerald-700 underline" href="/privacy">Privacy Policy</a> for details about account information, providers, retention and user requests.</p>
  </PageShell>;
}

export default function PublicDocument({ path, contactEmail = CONTACT_EMAIL }: { path: string; contactEmail?: string }) {
  const route = normalizePath(path);
  if (route === '/about') return <AboutPage />;
  if (route === '/contact') return <ContactPage email={contactEmail} />;
  if (route === '/privacy') return <PrivacyPage email={contactEmail} />;
  if (route === '/terms') return <TermsPage email={contactEmail} />;
  if (route === '/ads-disclosure') return <AdsDisclosurePage />;
  return <PageShell><h1 className="mt-8 text-3xl font-bold text-slate-950">Page not found</h1></PageShell>;
}
