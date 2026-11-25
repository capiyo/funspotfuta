import React from 'react';

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#101713] px-6 py-16 text-center text-[#f2f7f3]">
      <div className="w-full max-w-xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">Funspot · 404</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">This page isn't here.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#b8c6bc]">
          The address may be outdated or the page may have moved. Head back to Funspot and continue from the homepage.
        </p>
        <a href="/" className="mt-8 inline-flex rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-[#102017] transition hover:bg-emerald-300">
          Return to Funspot
        </a>
        <footer className="mt-12 border-t border-white/[0.08] pt-6 text-xs text-[#91a197]">
          <nav aria-label="Public pages" className="flex flex-wrap justify-center gap-x-5 gap-y-3">
            <a href="/about">About</a>
            <a href="/contact">Contact</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
            <a href="/ads-disclosure">Cookie and Ads Disclosure</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="rounded-3xl bg-white/[0.045] p-6">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm leading-7 text-[#b8c6bc]">{children}</p>
    </article>
  );
}

export default function PublicHome() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#101713] text-[#f2f7f3]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <a href="/" aria-label="Funspot home" className="text-xl font-black tracking-tight text-white">funspot<span className="text-emerald-400">.</span></a>
          <a href="/app/" className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#102017] transition hover:bg-emerald-300">
            Open Funspot
          </a>
        </header>

        <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-[1.15fr_0.85fr] md:py-24">
          <div>
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">A home for football fans</p>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl">
              Football is better <span className="text-emerald-400">together.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-8 text-[#b8c6bc] sm:text-lg">
              Follow fixtures, join match conversations, share your football perspective and connect with supporters who care about the game.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="/app/" className="rounded-full bg-emerald-400 px-7 py-3.5 text-sm font-bold text-[#102017] transition hover:bg-emerald-300">
                Join the community
              </a>
              <a href="/how-it-works.html" className="rounded-full bg-white/[0.07] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.12]">
                How Funspot works
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[2rem] bg-[#18231c] p-6 shadow-2xl shadow-black/20 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-400">The matchday space</span>
                <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">Community</span>
              </div>
              <div className="mt-8 space-y-3">
                <div className="rounded-2xl bg-white/[0.055] p-4">
                  <p className="text-xs text-[#91a197]">Fixtures</p>
                  <p className="mt-1 font-semibold">Keep up with the games that matter.</p>
                </div>
                <div className="rounded-2xl bg-white/[0.055] p-4">
                  <p className="text-xs text-[#91a197]">Conversations</p>
                  <p className="mt-1 font-semibold">Talk football with your community.</p>
                </div>
                <div className="rounded-2xl bg-white/[0.055] p-4">
                  <p className="text-xs text-[#91a197]">Fan activity</p>
                  <p className="mt-1 font-semibold">Share posts, predictions and opinions.</p>
                </div>
              </div>
              <p className="mt-6 text-xs leading-6 text-[#91a197]">One place for fixtures, supporters and the conversations around the game.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/[0.08] py-10 sm:grid-cols-3">
          <Feature title="Follow fixtures">Stay close to upcoming matches and the football conversations around them.</Feature>
          <Feature title="Find your people">Join channels and connect with supporters who follow the teams and competitions you do.</Feature>
          <Feature title="Take part">Share posts, discuss matches, make community predictions and explore leaderboards.</Feature>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/[0.08] py-7 text-xs text-[#91a197] sm:flex-row sm:items-center sm:justify-between">
          <p>© Funspot. A community for football fans.</p>
          <nav aria-label="Public pages" className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="hover:text-white" href="/about">About</a>
            <a className="hover:text-white" href="/contact">Contact</a>
            <a className="hover:text-white" href="/privacy">Privacy Policy</a>
            <a className="hover:text-white" href="/terms">Terms of Service</a>
            <a className="hover:text-white" href="/ads-disclosure">Cookie and Ads Disclosure</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
