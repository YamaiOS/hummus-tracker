# Phase 1 Edge Research — Findings
Data: Brent+OVX+GPRD daily, 1987-05-20→2026-06-15. Signal = daily GPR (proxy for the live composite risk index).

## H1 — Does GPR improve forward realized-vol forecasts beyond OVX+HAR?
Pre-registered pass: GPR coeff HAC-significant (p<0.05) AND walk-forward OOS R²(HAR+OVX+GPR) > OOS R²(HAR+OVX). Kill: GPR is an OVX shadow (no lift).
  h= 5d n=4823: GPR coef=+0.001 HAC t=+0.30 p=0.767 | OOS R²  HAR=0.293 +OVX=0.433 +GPR=0.432 (Δ=-0.0004)
  h=10d n=4818: GPR coef=+0.001 HAC t=+0.29 p=0.773 | OOS R²  HAR=0.235 +OVX=0.447 +GPR=0.446 (Δ=-0.0007)
  h=21d n=4807: GPR coef=-0.001 HAC t=-0.21 p=0.834 | OOS R²  HAR=0.107 +OVX=0.433 +GPR=0.433 (Δ=-0.0008)

## H8 — Does a GPR spike raise P(Brent tail move |r|>2σ next 5d)?
Pre-registered pass: P(tail | GPR top decile) materially > base rate, and GPR significant in a logistic with OVX. Kill: equals base rate given OVX.
  [overlapping 5d] base P(tail)=0.236 | P|GPR<median=0.231 mid=0.222 top-decile=0.313 (lift=1.33x)
  [overlapping 5d] logistic tail~OVX+GPR: OVX coef=+0.013 p=0.000 | GPR coef=+0.140 p=0.000  (p inflated by overlap)
  [robust a · next-1d, no overlap] base=0.058 top-decile=0.091 (lift=1.58x) | logistic GPR coef=+0.189 p=0.000
  [robust b · non-overlap 5d blocks n=965] base=0.240 top-decile=0.330 (lift=1.37x) | logistic GPR coef=+0.138 p=0.053
  [robust c · block-bootstrap] observed lift=1.33x, bootstrap p(lift≥observed by chance)=0.464
