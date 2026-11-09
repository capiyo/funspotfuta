import { editorialArticles } from '../content/editorial';

export default function EditorialHomeBlock() {
  return (
    <section aria-labelledby="funspot-editorial-heading" className="mx-3 mb-3 rounded-2xl bg-white/[0.045] px-4 py-4 text-[var(--home-text-primary)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--home-primary)]">From Funspot Insights</p>
      <h1 id="funspot-editorial-heading" className="mt-2 text-xl font-bold leading-tight">Football makes more sense when you know the story behind the fixture.</h1>
      <p className="mt-3 text-sm leading-7 text-[var(--home-text-secondary)]">
        Follow the game with context, not just the score. Funspot Insights is an independent collection of practical football explainers for supporters in Kenya and beyond. Learn how league seasons and European competitions are organised, what a fixture list can tell you, and how to read recent form without treating a short run of results as a guarantee. We also explain how Funspot community predictions and points are represented in the app, including the limits of what the published scoring fields can tell you. Our match-preview guide shows how to build an analysis from confirmed fixture information, while our community guide offers ways to debate passionately without personal abuse. The aim is to make football easier to follow, help readers ask better questions and keep facts separate from opinion. Schedules, team news and broadcasting rights can change, so check current official competition information and licensed local viewing schedules when planning for a match. Predictions are for community participation and use in-app points; they are not real-money betting.
      </p>
      <nav aria-label="Featured football insights" className="mt-4 grid gap-2 sm:grid-cols-3">
        {editorialArticles.slice(0, 3).map((article) => (
          <a key={article.slug} href={'/insights/' + article.slug} className="rounded-xl bg-white/[0.055] px-3 py-3 text-sm font-semibold leading-5 text-[var(--home-primary)] underline decoration-transparent underline-offset-4 hover:decoration-current">
            {article.title}
          </a>
        ))}
      </nav>
    </section>
  );
}
