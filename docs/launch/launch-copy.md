# Launch copy — Hummus Tracker (oil.yieldwise.my)

Ready-to-post. Hook (red-team validated): *built a Hormuz monitor on free public
data, tried to find a trading edge, failed, and publish the null — every panel
tagged LIVE/EST/SIM, no LLM, no paywall, ~$0 to run.* Honest, differentiated, and
turns the four biggest "weaknesses" (sim vessels, made-up index, can't-predict-oil,
GPT-wrapper) into the selling points.

Guardrails baked in: say "~$0 at idle (~2–3s cold start)" not bare "$0"; never claim
prediction; vessels are SIM; keep it non-commercial (no product pitch).

---

## 1) Show HN

**Title:**
> Show HN: I built a Strait of Hormuz oil/LNG monitor, then failed to find a trading edge

**Body:**
> https://oil.yieldwise.my
>
> It's a free, transparent monitoring dashboard for the Strait of Hormuz — the chokepoint ~20% of the world's seaborne oil and ~20% of global LNG (all of Qatar's) passes through. It pulls only free public data: oil/gas prices (FRED/EIA), chokepoint transit counts (IMF PortWatch), geopolitical-risk index (Caldara-Iacoviello GPR), terminal weather & marine (Open-Meteo), regional seismicity (USGS), and a classified news/incident wire (Google News RSS). No LLM anywhere — just data and keyword classification.
>
> The thing I'm actually proud of is the honesty layer. Every panel is tagged **LIVE / EST / SIM** so you always know what's real, what's modeled, and what's simulated. (Real vessel/AIS positions aren't available for free in the Gulf, so the map is explicitly a *simulated demo* — I refuse to dress fake tanker tracks up as real.)
>
> There's a composite "Hormuz Risk Index" (8 components, transparent hand-set weights, fully decomposed on screen). So I did the obvious thing and tested whether it can actually *predict* oil markets — lead-lag on monthly returns, incremental realized-vol forecasting vs. the options market, a tail-probability test, and a cross-sectional energy/shipping equity event study. **It can't.** Markets price geopolitical risk within hours (Brent pops ~2.6% on an event day, then fully reverts within a week). I published the null result *in the dashboard itself* — including a bug an adversarial review caught in my own bootstrap. It's a monitoring/situational-awareness tool, not a trading signal, and I'd rather say so.
>
> Tech: it's a static hourly snapshot. A batch job runs every hour, dumps every endpoint to JSON on a small volume, and a tiny server just serves those files + the SPA. It scale-to-zeros on Fly, so it's ~$0 at idle (~2–3s cold start on first hit), refreshed by a scheduled machine + a GitHub Actions cron. 41 endpoints, ~17 backend tests, Playwright QA.
>
> Honest limitations: simulated vessels, hourly (not real-time) cadence, and incident counts are a headline-keyword heuristic that can miss/over-count. Built solo. Feedback very welcome — especially on the risk-index methodology and anything I've gotten wrong.

---

## 2) X / Twitter thread

**1/**
I built a free Strait of Hormuz oil/LNG monitoring dashboard on 100% public data — then tried to find a trading edge in it and failed.

So I published the failure inside the dashboard.

🔗 oil.yieldwise.my

**2/**
Hormuz = ~20% of seaborne oil + ~20% of global LNG (all of Qatar's), and LNG has *no* pipeline bypass.

It pulls FRED/EIA prices, IMF PortWatch transit counts, GPR geopolitical-risk, USGS quakes, Open-Meteo weather/marine, and a classified news wire. No LLM — just data.

**3/**
The point isn't a risk score. It's the honesty layer: every panel is tagged **LIVE / EST / SIM**.

Real Gulf AIS isn't free, so the vessel map is a clearly-labeled *simulated demo*. I won't pass fake tanker tracks off as real.

**4/**
There's a transparent "Hormuz Risk Index" (8 components, weights all shown). I tested if it predicts oil: lead-lag, realized-vol vs OVX, tail probability, an equity event study.

Result: no tradable edge. Markets price geopolitical risk in hours.

**5/**
I put the null result *on the dashboard* — incl. a bug an adversarial review caught in my own bootstrap (it flipped a "chance" finding to "real but weak"). Showing your work, bugs and all, is the moat.

**6/**
Tech: hourly static snapshot, scale-to-zero on Fly → ~$0 at idle (~2–3s cold start). 41 endpoints, backend tests, Playwright QA. Solo build.

It's monitoring & situational awareness — not a trading signal. Feedback welcome 🙏

---

## 3) LinkedIn

> I built a Strait of Hormuz oil & LNG monitoring dashboard — and then did something most "risk dashboards" never do: I tested whether it actually predicts the market, found that it doesn't, and published that result inside the product.
>
> 🔗 oil.yieldwise.my
>
> Why it might be interesting:
> • **Free public data only** — FRED/EIA prices, IMF PortWatch chokepoint transits, Caldara-Iacoviello geopolitical-risk, USGS, Open-Meteo, a classified news wire. No LLM in the pipeline.
> • **Radical transparency** — every panel labeled LIVE / EST / SIM, so you always know what's real vs. modeled vs. simulated. (Gulf AIS isn't free, so the vessel map is an honest simulated demo, not a fake feed.)
> • **Evidence-first** — I ran lead-lag, volatility, tail-risk and cross-sectional equity event studies on the risk index. No tradable edge — markets price geopolitical risk within hours. An adversarial review even caught a bug in my own statistics, which I fixed and disclosed.
> • **~$0 to run** — a static hourly snapshot that scale-to-zeros on Fly.
>
> It's a monitoring and situational-awareness tool, not a trading signal — and I think being honest about that is the most valuable thing it does. Feedback welcome, especially on methodology.

---

## Pre-post checklist (from the red-team)
- [ ] OVX licensing resolved (DONE — now self-computed realized vol, public domain).
- [ ] Page carries the Data Sources & Attributions panel (DONE) incl. Open-Meteo link.
- [ ] No commercial / YieldWise product pitch on the page (protects Open-Meteo non-commercial tier + the "public-interest not lead-gen" optics). ← confirm.
- [ ] Lead with the live data; simulated vessel map is demoted (DONE).
- [ ] Copy says "~$0 idle" not bare "$0"; incident counts labeled a heuristic (DONE).
- [ ] Consider a neutral domain if the yieldwise.my brand reads as lead-gen.
