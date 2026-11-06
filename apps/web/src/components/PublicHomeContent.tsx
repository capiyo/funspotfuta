import React from 'react';

/**
 * Public homepage content is rendered on the server and hydrated in place.
 * It is visible to every visitor; it is not a crawler-only page.
 */
export default function PublicHomeContent() {
  return (
    <section className="public-home-content" aria-labelledby="public-home-title">
      <div className="public-home-inner">
        <header className="public-home-heading">
          <p className="public-home-eyebrow">A home for the football conversation</p>
          <h1 id="public-home-title">Football is better together.</h1>
          <p className="public-home-lead">
            Funspot is a football fan community built around fixtures, match conversations,
            supporter predictions and the people who make following football more engaging.
            Follow the competitions you care about, meet fans who see the game differently
            and keep the conversation connected to the match.
          </p>
        </header>

        <div className="public-home-grid">
          <article>
            <h2>Find your football community</h2>
            <p>
              Explore channels built around football competitions and shared interests.
              Join supporters who follow the same leagues, teams and football stories.
              Channels give each community a clear place to gather and keep its discussions
              organized.
            </p>
          </article>
          <article>
            <h2>Keep the match in view</h2>
            <p>
              Fixture conversations keep the teams and match context close to the discussion.
              Follow the build-up, exchange opinions and return to the same fixture as the
              match develops. The aim is to make it easy to know which game everyone is
              talking about.
            </p>
          </article>
          <article>
            <h2>Share beyond the fixture</h2>
            <p>
              The community feed gives supporters room to publish football posts and respond
              to other fans. It makes space for opinions, reactions and football stories that
              are not limited to one match or one channel.
            </p>
          </article>
        </div>

        <section className="public-home-how" aria-labelledby="public-home-how-title">
          <h2 id="public-home-how-title">How Funspot works</h2>
          <ol>
            <li><strong>Choose a channel.</strong> Find a competition or football topic that interests you.</li>
            <li><strong>Open a fixture.</strong> Enter the match conversation with the fixture context in view.</li>
            <li><strong>Make your prediction.</strong> When predictions are open, select the home or away outcome.</li>
            <li><strong>Follow the community.</strong> See conversations, points and leaderboard positions as eligible results are settled.</li>
          </ol>
        </section>

        <div className="public-home-grid public-home-details">
          <article>
            <h2>Predictions and points</h2>
            <p>
              A fixture prediction records a supporter’s view of a match; it is not a
              guaranteed result, financial advice or a promise of a reward. Where the app
              awards points, the record is updated under the applicable fixture and
              community rules after a verified result is settled. In-app points are not cash
              or an investment balance.
            </p>
          </article>
          <article>
            <h2>Respectful football communities</h2>
            <p>
              Strong football opinions are welcome when shared respectfully. Protect other
              people’s information and only publish material you have the right to share.
              Read the service terms and privacy information before creating an account or
              contributing to the community.
            </p>
          </article>
          <article>
            <h2>Learn more about Funspot</h2>
            <p>
              Find out about the community, how fixture conversations work, how information
              is handled and how to contact the service team. These public pages explain the
              service for supporters, visitors and people discovering Funspot for the first
              time.
            </p>
            <nav aria-label="Funspot information">
              <a href="/about.html">About</a>
              <a href="/how-it-works.html">How it works</a>
              <a href="/contact.html">Contact</a>
              <a href="/terms.html">Terms</a>
              <a href="/privacy.html">Privacy</a>
            </nav>
          </article>
        </div>
        <footer className="public-home-footer">© Funspot. A community for football fans.</footer>
      </div>
    </section>
  );
}
