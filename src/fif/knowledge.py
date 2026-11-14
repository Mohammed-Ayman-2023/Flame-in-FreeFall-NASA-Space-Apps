"""Mission presets, investigation summaries, crew takeaways, the "Ask the archive" search and the mission
briefing. Everything a number says is computed here from dataset v1 or the v1 models, never typed in, except
the short descriptive sentences in INVESTIGATIONS, which restate the PSI investigation pages (data/raw/*/).

Evidence labels used everywhere (shown with a word, never colour alone):
  measured   NASA test result (PSI data or a verified NASA report table)
  model      prediction of one of our models (models/v1)
  literature statement from a NASA investigation page or report, not a test row
  gap        what the data do not cover
"""
from __future__ import annotations

import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
REPO_URL = "https://github.com/Mohammed-Ayman-2023/Flame-in-FreeFall-NASA-Space-Apps"
PSI_URL = "https://psi.nasa.gov/physci/repo/data/investigations/{}"
NTRS_SAFFIRE6 = "https://ntrs.nasa.gov/citations/20240002981"

# ------------------------------------------------------------------------------------------- missions
# The three NASA spacecraft atmospheres are named in the ACME BRE (PSI-20) investigation page:
# "14.7 psia, 21 % oxygen; 10.2 psia, 26.5 %; and 8.2 psia, 34 % oxygen".
PSIA = 1 / 14.696
CFIG_GAP = (0.234, 0.332)  # ACME CFI-G has no tests between 23.4 % and 33.2 % O2
MISSIONS = {
    "habitat": dict(label="Challenge habitat · 30 % O₂, 0.69 atm", x_o2=0.30, pressure_atm=0.69,
                    note="The crewed-habitat atmosphere this project was built around.",
                    source="Challenge habitat point"),
    "iss": dict(label="ISS cabin · 21 % O₂, 14.7 psia", x_o2=0.21, pressure_atm=1.0,
                note="Sea-level air, as on the ISS today.", source="NASA atmosphere listed in ACME BRE (PSI-20)"),
    "exploration": dict(label="Exploration atmosphere · 26.5 % O₂, 10.2 psia", x_o2=0.265,
                        pressure_atm=round(10.2 * PSIA, 3),
                        note="Reduced pressure, enriched oxygen: shortens spacewalk preparation.",
                        source="NASA atmosphere listed in ACME BRE (PSI-20)"),
    "lunar": dict(label="Lunar habitat proposal · 34 % O₂, 8.2 psia", x_o2=0.34, pressure_atm=round(8.2 * PSIA, 3),
                  note="The lowest-pressure, richest-oxygen atmosphere NASA has considered for surface habitats.",
                  source="NASA atmosphere listed in ACME BRE (PSI-20)"),
}
GRAVITY_NOTE = ("All tests here ran in microgravity (ISS, Cygnus) or, for comparison, on Earth. No PSI investigation "
                "has burned anything at lunar (0.16 g) or Martian (0.38 g) gravity, so for Moon and Mars surface "
                "habitats these results are the nearest evidence, not a measurement.")

# ------------------------------------------------------------------------------------- investigations
# what: restated from the PSI investigation page; area: prevention / detection / suppression / fundamentals
INVESTIGATIONS = {
    "PSI-26": dict(what="Burned fabric (cotton-fiberglass SIBAL), acrylic (PMMA), Nomex, Ultem and candles in a small "
                        "ISS glovebox flow duct, in air flowing with or against the flame, and tested a CO₂-like "
                        "extinguishing agent.", area="prevention, suppression", platform="ISS glovebox", years="2009-2013"),
    "PSI-25": dict(what="Follow-on to BASS: acrylic slabs, rods and spheres, fabric and candles burned at different "
                        "air speeds and oxygen levels to find when a flame starves or blows off.",
                   area="prevention, suppression", platform="ISS glovebox", years="2011-2013"),
    "PSI-98": dict(what="The first large spacecraft fire: a 94 × 40 cm cotton-fiberglass sheet burned inside an empty "
                        "Cygnus cargo ship after it left the ISS, to see how fast a big fire grows.",
                   area="prevention, detection", platform="Cygnus (after ISS)", years="2016"),
    "PSI-99": dict(what="Nine smaller samples (fabric, acrylic, Nomex, silicone) burned on Cygnus, each also burned on "
                        "Earth, to compare the flammability screening test with real microgravity fires.",
                   area="prevention", platform="Cygnus (after ISS)", years="2016"),
    "PSI-100": dict(what="A second large cotton-fiberglass sheet burned on Cygnus, with flow in both directions.",
                    area="prevention, detection", platform="Cygnus (after ISS)", years="2017"),
    "EXT-SAFFIRE-456": dict(what="Saffire IV to VI on Cygnus: fabric, cotton, acrylic and Nomex burned in reduced-"
                                 "pressure, oxygen-rich air (54-71 kPa, 26-31 % O₂), with cabin CO₂ and CO measured. "
                                 "Published in NASA reports, not in PSI.",
                            area="prevention, detection", platform="Cygnus (after ISS)", years="2019-2023"),
    "PSI-20": dict(what="A porous gas burner that imitates burning solids, run in still air at the spacecraft "
                        "atmospheres NASA has considered (14.7 psia/21 %, 10.2 psia/26.5 %, 8.2 psia/34 %).",
                   area="prevention", platform="ISS Combustion Integrated Rack", years="2019-2021"),
    "PSI-159": dict(what="Spherical gas flames (ethane, propane, butane) in a closed, still chamber from 18 to 40 % O₂ "
                         "and 0.5 to 3 atm: does a flame ignite, and does it go out by itself?",
                    area="prevention, fundamentals", platform="ISS Combustion Integrated Rack", years="2021"),
    "PSI-69": dict(what="Free-floating fuel droplets (heptane, methanol and others) burned on the ISS to map when "
                        "liquid-fuel flames go out and how well CO₂ and helium suppress them.",
                   area="suppression, prevention", platform="ISS Combustion Integrated Rack", years="2009-2012"),
    "PSI-68": dict(what="Follow-on to FLEX with fuel mixtures closer to real fuels, droplet arrays and soot, over "
                        "0.5-3 atm and up to 40 % O₂. PSI lists its condition ranges, not per-test results.",
                   area="suppression, fundamentals", platform="ISS Combustion Integrated Rack", years="2016-2019"),
    "PSI-39": dict(what="Cool-flame droplet tests (dodecane and mixtures) at 0.25-5 atm: the invisible low-"
                        "temperature flame that can survive after the visible flame goes out.",
                   area="fundamentals", platform="ISS Combustion Integrated Rack", years=""),
    "PSI-117": dict(what="Droplet cool-flame measurements and simulations (heptane, decane, dodecane) and how outside "
                         "disturbances change them.", area="fundamentals", platform="ISS + simulation", years=""),
    "PSI-142": dict(what="Cool-flame transitions near radiation and stretch extinction in counterflow flames.",
                    area="fundamentals", platform="ground + ISS analysis", years=""),
    "PSI-102": dict(what="Overheated (not burning) spacecraft materials made smoke in the ISS glovebox, to see how big "
                         "microgravity smoke particles get and whether smoke detectors notice them.",
                    area="detection", platform="ISS glovebox", years="2001-2008"),
    "PSI-101": dict(what="Reflight of SAME with new materials (Pyrell foam), hotter heating and no-flow runs, after "
                         "SAME's particle samples came back contaminated.",
                    area="detection", platform="ISS glovebox", years="2010"),
    "PSI-115": dict(what="Modelling and simulation of smoke generation in microgravity using SAME data.",
                    area="detection", platform="simulation", years=""),
    "PSI-107": dict(what="Gas jet flames in co-flowing air, raising the fuel flow until the flame starts releasing "
                         "soot (its smoke point), for six fuels and three nozzle sizes.",
                    area="detection, fundamentals", platform="ISS glovebox", years="2010-2012"),
    "PSI-60": dict(what="Computational and experimental analysis of the SPICE soot data sets.", area="fundamentals",
                   platform="analysis", years=""),
    "PSI-106": dict(what="How gas jet flames anchor and lift off in co-flowing air, for methane, ethylene and "
                         "nitrogen-diluted mixtures (12 test days).", area="fundamentals", platform="ISS glovebox",
                    years="2012"),
    "PSI-21": dict(what="Coflow laminar diffusion flames from dilute to sooting gaseous fuels.", area="fundamentals",
                   platform="ISS Combustion Integrated Rack", years=""),
    "PSI-10": dict(what="Flame design: normal and inverse gas flames tuned to be soot-free.", area="fundamentals",
                   platform="ISS Combustion Integrated Rack", years=""),
    "PSI-23": dict(what="Structure and response of spherical gas diffusion flames.", area="fundamentals",
                   platform="ISS Combustion Integrated Rack", years=""),
    "PSI-22": dict(what="Effects of electric fields on laminar gas flames.", area="fundamentals",
                   platform="ISS Combustion Integrated Rack", years=""),
    "PSI-62": dict(what="A computer model of concurrent flame spread compared with BASS flame measurements.",
                   area="prevention", platform="simulation", years=""),
}


def _read(path: Path, **kw) -> pd.DataFrame:
    return pd.read_csv(path, low_memory=False, **kw)


def load() -> dict:
    """Everything the knowledge layer needs, read once."""
    d = dict(tests=_read(ROOT / "data/processed/tests.csv"), ev=_read(ROOT / "data/processed/evidence.csv"),
             cat=_read(ROOT / "catalog/investigations.csv"), A=_read(ROOT / "ml/v1/A_solids_flammability.csv"),
             B=_read(ROOT / "ml/v1/B_solids_spread.csv"), D=_read(ROOT / "ml/v1/D_gas_flames.csv"))
    d["D_pack"] = joblib.load(ROOT / "models/v1/D_gas_flames.joblib")
    d["C_pack"] = joblib.load(ROOT / "models/v1/C_droplets.joblib")
    d["explain"] = json.loads((ROOT / "models/v1/explain.json").read_text())
    return d


def doi_of(K: dict, psi: str) -> str | None:
    s = K["tests"].loc[K["tests"].investigation_id == psi, "doi"].dropna()
    if len(s):
        return str(s.iloc[0])
    page = next((ROOT / "data/raw" / psi).glob("*page*.txt"), None) if (ROOT / "data/raw" / psi).exists() else None
    if page:
        m = re.search(r"DOI:\s*(\S+)", page.read_text(errors="ignore"))
        return m.group(1) if m else None
    return None


def link_of(psi: str, doi: str | None) -> str:
    if psi.startswith("EXT"):
        return NTRS_SAFFIRE6
    if doi and doi.startswith("10."):
        return f"https://doi.org/{doi}"
    return PSI_URL.format(psi)


def _span(lo, hi, fmt, unit="", same=None):
    a, b = fmt.format(lo), fmt.format(hi)
    if a == b:
        return same.format(a) if same and float(lo) == 0 else f"{a}{unit}"
    return f"{a}–{b}{unit}"


def investigation_table(K: dict) -> pd.DataFrame:
    """One row per in-scope investigation: summary text plus conditions and outcomes computed from the data."""
    t, c = K["tests"], K["cat"]
    c = c[c["in_scope"].astype(str).isin(["True", "true", "1"]) & ~c["psi_id"].str.contains(r"\?", regex=True)]
    mu = t[t["gravity_g"].fillna(0) == 0]
    rows = []
    for _, r in c.iterrows():
        psi = r.psi_id
        s = mu[mu.investigation_id == psi]
        info = INVESTIGATIONS.get(psi, {})
        doi = doi_of(K, psi)
        if len(s):
            o2 = _span(s.x_o2.min(), s.x_o2.max(), "{:.0%}") if s.x_o2.notna().any() else "not recorded"
            p = (_span(s.pressure_atm.min(), s.pressure_atm.max(), "{:.2f}", " atm") if s.pressure_atm.notna().any()
                 else "not recorded per test")
            fl = s.flow_cm_s.dropna()
            flow = _span(fl.min(), fl.max(), "{:.0f}", " cm/s", same="still air ({} cm/s)") if len(fl) else "—"
            fuels = ", ".join(sorted(set(s.fuel.dropna().astype(str).str.replace(r"\s*\(.*\)", "", regex=True)))[:8])
        else:
            o2 = (f"{r.o2_min:.0%}–{r.o2_max:.0%} (PSI range)" if pd.notna(r.o2_min) and pd.notna(r.o2_max)
                  else "not listed")
            p = (f"{r.p_min_atm:.2f}–{r.p_max_atm:.2f} atm (PSI range)" if pd.notna(r.p_min_atm) else "not listed")
            flow, fuels = "—", str(r.fuels) if isinstance(r.fuels, str) else "—"
        level = {"loaded": "test data loaded"}.get(str(r.data_status), "catalog only")
        rows.append(dict(psi_id=psi, acronym=r.acronym, name=r["name"], family=r.family,
                         platform=info.get("platform", r.platform if isinstance(r.platform, str) else ""),
                         years=info.get("years", ""), area=info.get("area", ""), what=info.get("what", r["name"]),
                         fuels=fuels, o2_tested=o2, pressure_tested=p, flow_tested=flow, n_tests=len(s),
                         data=level, doi=doi or "", link=link_of(psi, doi), key_result=key_result(K, psi),
                         notes=r.notes if isinstance(r.notes, str) else "",
                         hardware=hardware_text(K, psi), samples=sample_text(K, psi),
                         measurements=measurements_text(K, psi), **_var_cols(K, psi),
                         context=CONTEXT.get(psi, "")))
    return pd.DataFrame(rows)


def _var_cols(K: dict, psi: str) -> dict:
    v = variables(K, psi)
    if not v["n"]:
        return dict(varied="per-test data not loaded", held_same="per-test data not loaded")
    return dict(varied="; ".join(v["varied"]) or "nothing recorded as varying",
                held_same="; ".join(v["same"]) or "nothing recorded as constant")


def key_result(K: dict, psi: str) -> str:
    """One sentence per investigation, numbers computed from the data."""
    t, ev, B, D = K["tests"], K["ev"], K["B"], K["D"]
    mu = t[(t.investigation_id == psi) & (t.gravity_g.fillna(0) == 0)]
    if psi == "PSI-26":
        oc = mu.run_outcome.value_counts()
        return (f"{oc.get('sustained', 0)} of {len(mu)} runs kept burning, {oc.get('not_sustained', 0)} went out and "
                f"{oc.get('no_ignition', 0)} never lit; fabric spread up to "
                f"{B[B.investigation_id == 'PSI-26'].spread_rate_mm_s.max():.1f} mm/s in the 7.6 cm duct.")
    if psi == "PSI-25":
        a = K["A"][K["A"].investigation_id == "PSI-25"]
        return (f"{len(mu)} tests mapped a ‘Goldilocks’ window: {int((a.flame_sustained == 0).sum())} flame-outs, from "
                f"flames starving at low air speed and blowing off at high speed.")
    if psi in ("PSI-98", "PSI-100"):
        b = B[B.investigation_id == psi]
        return (f"The large fabric sheet burned in microgravity, spreading up to {b.spread_rate_mm_s.max():.1f} mm/s "
                f"with the flow, at measured cabin pressure.")
    if psi == "PSI-99":
        sil = mu[mu.fuel.str.contains("Silicone", na=False)]
        return (f"Silicone burned on Earth but did not spread in microgravity ({int((sil.burn_extent == 'none').sum())} "
                f"of {len(sil)} samples); Nomex did not burn; fabric and acrylic did.")
    if psi == "EXT-SAFFIRE-456":
        x = ev[ev.investigation_id == psi].pivot_table(index="test_id", columns="quantity", values="value")
        pm = x.loc[[i for i in x.index if i.endswith(("VI-3", "VI-4"))], "co2_increase_ffd"]
        return (f"The only solid-fuel burns near habitat air: fabric, cotton and acrylic burned at 26-31 % O₂ and "
                f"0.53-0.70 atm, Nomex did not ignite; burning acrylic raised cabin CO₂ by "
                f"{pm.min():,.0f}-{pm.max():,.0f} ppm.")
    if psi == "PSI-159":
        d = D[D.ready_burn_time]
        lo = d[d.x_o2 <= 0.25]
        hi = d[d.x_o2 > 0.33]
        return (f"In still air, all {len(lo)} flames at ≤25 % O₂ went out by themselves (median {lo.burn_time_s.median():.0f} s); "
                f"at 33-40 % O₂ the median was {hi.burn_time_s.median():.0f} s and {int((hi.self_extinguished == 0).sum())} "
                f"of {len(hi)} were still burning when the fuel was cut.")
    if psi == "PSI-20":
        return ("Emulated solids kept burning in still air at raised oxygen, while flames at 21 % O₂ went out on their "
                "own (investigation page). Daily summaries only, no per-flame results.")
    if psi == "PSI-69":
        hab = mu[(mu.x_o2 >= 0.29) & (mu.pressure_atm.between(0.6, 0.8))]
        return (f"{len(mu)} droplet tests; {len(hab)} ran at 29-34 % O₂ and about 0.7 atm, the closest any "
                f"investigation came to the habitat air; CO₂ and helium were tested only up to "
                f"{mu[(mu.x_co2.fillna(0) > 0) | (mu.x_he.fillna(0) > 0)].x_o2.max():.0%} O₂.")
    if psi in ("PSI-101", "PSI-102"):
        return f"{mu.parent_test.isna().sum() if 'parent_test' in mu else len(mu)} smoke test conditions, all in cabin air (21 % O₂, 1 atm); results are in raw files not loaded."
    if psi == "PSI-107":
        return f"{len(mu)} fuel-flow settings from {mu.run_id.nunique()} flame runs, all in cabin air; smoke points are in raw files not loaded."
    if psi == "PSI-39":
        return f"{len(mu)} test conditions loaded (conditions only)."
    if psi == "PSI-117":
        return f"{len(mu)} measurements and simulations of droplet cool flames used in the droplet model."
    return "Catalogued from its PSI record; per-test results not loaded."


# ------------------------------------------------------------------------------------------ takeaways
def _d_predict(K: dict, x_o2: float, p: float) -> tuple[float, float]:
    m, feats = K["D_pack"]["model"], K["D_pack"]["features"]
    q = pd.DataFrame([dict(x_o2=x_o2, pressure_atm=p, log_mdot=0.0, fuel_mole_fraction=0.3, fuel_propane=1,
                           fuel_butane=0)])
    med = float(m.predict_median(q[feats]).iloc[0])
    s30 = float(m.predict_survival_function(q[feats], times=[30.0]).iloc[0, 0])
    return med, s30


def _c_predict(K: dict, x_o2: float, p: float, fuel: str = "methanol") -> float:
    from . import models as M
    pk = K["C_pack"]["burning_rate_mm2_s"]
    q = pd.DataFrame([dict(fuel=fuel, d0_mm=3.0, x_co2=0.0, x_he=0.0, x_o2=x_o2, pressure_atm=p)])
    X = M._c_features(q, pk["fuels"])
    Xs = np.column_stack([pk["scaler"].transform(X[:, :len(M.C_NUM)]), X[:, len(M.C_NUM):]])
    return float(pk["model"].predict(Xs)[0])


def near(df: pd.DataFrame, x_o2: float, p: float, do2=0.05, dp=0.2) -> pd.DataFrame:
    return df[((df.x_o2 - x_o2).abs() <= do2) & ((df.pressure_atm - p).abs() <= dp)]


def takeaways(K: dict, x_o2: float, p: float) -> list[dict]:
    """Six crew takeaways for the chosen atmosphere, each with its number computed now."""
    out = []
    # 1 ventilation
    med, s30 = _d_predict(K, x_o2, p)
    med0, s300 = _d_predict(K, 0.21, 1.0)
    gap = CFIG_GAP[0] < x_o2 < CFIG_GAP[1]
    ratio = med / med0
    out.append(dict(
        key="vent", title=("Turning off the fans may not put the fire out" if s30 >= 0.05
                           else "In this air, still flames go out on their own"),
        number=f"×{ratio:.1f}" if abs(ratio - 1) > 0.05 else f"{med:.0f} s",
        text=(f"Stopping ventilation starves a microgravity flame. In still air at this atmosphere a gas flame is "
              f"predicted to burn a median {med:.0f} s (Earth cabin air: {med0:.0f} s), and {s30:.0%} are still burning "
              f"after 30 s (Earth cabin air: {s300:.0%})."),
        action="Plan to isolate and extinguish, not only to cut the airflow.",
        badge="model", source="ACME CFI-G (PSI-159) survival model; ACME BRE (PSI-20) reports the same",
        caveat="Interpolated: no CFI-G tests between 24 % and 33 % O₂." if gap else "", tab="Predict"))
    # 2 materials
    A = K["A"]
    sol = A[A.ready_for_model | A.investigation_id.eq("EXT-SAFFIRE-456")]
    nb = near(sol, x_o2, p)
    if len(nb):
        burned = nb[nb.flame_sustained == 1].material_family.str.replace("cotton-fiberglass", "fabric (SIBAL)").unique()
        out_ = nb[nb.flame_sustained == 0].material_family.unique()
        txt = (f"{len(nb)} real solid burns lie within ±5 % O₂ and ±0.2 atm of this atmosphere: "
               f"{', '.join(burned) or 'none'} kept burning"
               + (f"; {', '.join(out_)} did not." if len(out_) else "."))
        num, badge = f"{int((nb.flame_sustained == 1).sum())} of {len(nb)}", "measured"
    else:
        txt = ("No solid has ever been burned within ±5 % O₂ and ±0.2 atm of this atmosphere in microgravity. "
               "The closest evidence is the Saffire V-VI burns at 26-31 % O₂ and 0.53-0.70 atm, where fabric and "
               "acrylic burned and Nomex did not.")
        num, badge = "0 tests", "gap"
    out.append(dict(key="materials", title="Common cabin materials still burn", number=num, text=txt,
                    action="Screen habitat materials at the habitat atmosphere, not only in Earth air.", badge=badge,
                    source="Saffire IV-VI (NASA NTRS 20240002981), BASS, BASS-II, Saffire I-III", caveat="",
                    tab="Investigations"))
    # 3 toxic air
    ev = K["ev"]
    x = ev[ev.investigation_id == "EXT-SAFFIRE-456"].pivot_table(index="test_id", columns="quantity", values="value")
    pm = x.loc[[i for i in x.index if i.endswith(("VI-3", "VI-4"))]]
    fab = x.loc[[i for i in x.index if i.endswith(("IV-1", "V-2", "VI-2"))]]
    out.append(dict(
        key="toxic", title="A burning plastic poisons the cabin air", number=f"+{pm.co2_increase_ffd.max():,.0f} ppm",
        text=(f"On Cygnus, burning acrylic (PMMA) raised CO₂ by {pm.co2_increase_ffd.min():,.0f}-"
              f"{pm.co2_increase_ffd.max():,.0f} ppm and CO by {pm.co_increase_ffd.min():.0f}-{pm.co_increase_ffd.max():.0f} "
              f"ppm, against {fab.co2_increase_ffd.min():,.0f}-{fab.co2_increase_ffd.max():,.0f} ppm CO₂ for fabric."),
        action="Size air scrubbing and crew masks for plastic fires, not only for fabric.", badge="measured",
        source="Saffire VI, Table 2 (NASA NTRS 20240002981)", caveat="", tab="Key findings"))
    # 4 droplets
    k = _c_predict(K, x_o2, p)
    k0 = _c_predict(K, 0.21, 1.0)
    out.append(dict(
        key="droplets", title=("Spilled liquid fuel burns faster" if k / k0 > 1.03 else
                               "Spilled liquid fuel burns as in cabin air" if k / k0 > 0.97 else "Spilled liquid fuel burns slower"),
        number=f"{(k / k0 - 1):+.0%}",
        text=(f"A 3 mm methanol droplet is predicted to burn at {k:.2f} mm²/s here, against {k0:.2f} mm²/s in Earth "
              f"cabin air. CO₂ and helium suppression was only ever tested up to 25 % O₂."),
        action="Validate suppressant amounts at the habitat oxygen level before relying on them.", badge="model",
        source="FLEX (PSI-69) and PSI-117 droplet model", caveat="" if x_o2 <= 0.345 else "Above the tested O₂ range.",
        tab="Predict"))
    # 5 enclosure
    B = K["B"]
    b = B[(B.material_family == "cotton-fiberglass") & (B.flow_direction == "concurrent")]
    out.append(dict(
        key="space", title="Fire spreads faster in tight spaces", number=f"{b.spread_rate_mm_s.min():.1f} → {b.spread_rate_mm_s.max():.1f} mm/s",
        text=("The same fabric, in nearly the same air and air speed, spread almost three times faster in a 7.6 cm "
              "duct than in a 51 cm one."),
        action="Treat racks, ducts and stowage gaps as higher-risk zones.", badge="measured",
        source="Saffire I-IV and BASS; Olson et al., Table 1", caveat="", tab="Key findings"))
    # 6 detection
    t = K["tests"]
    smoke = t[t.fuel_class.eq("smoke_source") | t.investigation_id.eq("PSI-107")]
    # count tests, not re-measurements of aged smoke (SAME-R 'a' rows) or the duplicated row SAME-R flags
    smoke = smoke[smoke.parent_test.isna() & ~smoke.exclude.astype(str).str.lower().eq("true")]
    n_near = len(near(smoke.dropna(subset=["x_o2", "pressure_atm"]), x_o2, p))
    out.append(dict(
        key="detect", title="Smoke detectors are untested in this air" if n_near == 0 else "Smoke detection data exist here",
        number=f"{n_near} of {len(smoke)}",
        text=(f"{n_near} of {len(smoke)} smoke and soot tests (SAME, SAME-R, SPICE) were run within ±5 % O₂ and "
              f"±0.2 atm of this atmosphere; all of them used 21 % O₂ at 1 atm."),
        action="Test detector response to smoke made in the habitat atmosphere.",
        badge="gap" if n_near == 0 else "measured", source="SAME (PSI-102), SAME-R (PSI-101), SPICE (PSI-107)",
        caveat="", tab="Gaps"))
    return out


# -------------------------------------------------------------------------------------------- the Ask
SYNONYMS = {
    "fan": "ventilation airflow flow", "fans": "ventilation airflow flow", "ventilation": "airflow flow fan",
    "airflow": "flow ventilation", "wind": "flow airflow", "o2": "oxygen", "oxygen": "o2",
    "moon": "lunar habitat partial gravity", "lunar": "moon habitat", "mars": "martian partial gravity habitat",
    "fabric": "cotton sibal cloth textile", "cotton": "fabric sibal", "cloth": "fabric cotton",
    "plastic": "pmma acrylic", "acrylic": "pmma plastic", "pmma": "acrylic plastic",
    "smoke": "detector detection soot particles", "detector": "smoke detection", "soot": "smoke",
    "extinguish": "suppression suppressant extinction co2 helium", "suppress": "suppression suppressant co2",
    "spread": "spread rate flame spread", "toxic": "co co2 air quality", "fuel": "droplet liquid",
    "liquid": "droplet fuel", "spill": "droplet liquid fuel", "pressure": "atm psia kpa",
    "put": "extinguish suppression suppressant", "putting": "extinguish suppression", "stop": "extinguish",
    "agent": "suppressant co2 helium", "agents": "suppressant co2 helium", "helium": "suppressant he",
    "burn": "burning flammability", "burns": "burning flammability", "flammable": "flammability burning",
    "astronaut": "crew", "astronauts": "crew", "crew": "astronaut", "habitat": "lunar moon atmosphere",
    "nomex": "fabric fire resistant", "silicone": "rubber", "candle": "wax",
    "sensor": "instruments measured camera radiometer", "sensors": "instruments measured camera radiometer",
    "instrument": "instruments measured", "instruments": "measured sensors", "measure": "measured instruments",
    "hardware": "apparatus rack glovebox duct", "apparatus": "hardware", "rig": "hardware apparatus",
    "spacesuit": "suit pre-breathe 4.3 psi", "suit": "spacesuit", "prebreathe": "pre-breathe spacesuit",
    "bends": "decompression pre-breathe", "gravity": "partial lunar g", "dust": "daft p-trak",
    "varied": "changed between tests", "differ": "changed different", "similar": "shared hardware",
}


def corpus(K: dict) -> list[dict]:
    """Passages the Ask feature searches: our findings, the investigation summaries, model explanations, gaps,
    recommendations and the objectives of the PSI investigation pages."""
    from .ranking import RECOMMENDATIONS
    P = []
    for _, r in investigation_table(K).iterrows():
        P.append(dict(title=f"{r.acronym} ({r.psi_id})", text=f"{r.what} Key result: {r.key_result} Tested: O₂ "
                      f"{r.o2_tested}, pressure {r.pressure_tested}, fuels: {r.fuels}.", source=f"{r.acronym}, {r.link}",
                      badge="measured" if r.data == "test data loaded" else "literature", kind="Investigation"))
        P.append(dict(title=f"{r.acronym} ({r.psi_id}): hardware, samples, instruments and variables",
                      text=f"Hardware: {r.hardware}. Samples or burners: {r.samples}. Measured with: {r.measurements}. "
                           f"Changed between tests: {r.varied}. Held the same: {r.held_same}. {r.context}",
                      source=f"{r.acronym}, {r.link}", badge="measured" if r.data == "test data loaded" else "literature",
                      kind="Investigation details"))
    ex = K["explain"]
    trs = ex["D_gas_flames"]["time_ratios"]
    P.append(dict(title="What makes a still-air flame last longer", badge="model", kind="Model explanation",
                  source="ACME CFI-G survival model (models/v1)",
                  text="; ".join(f"{t_['effect']}: burn time ×{t_['time_ratio']:.2f}" for t_ in trs) +
                  ". Oxygen dominates: each extra 1 % O₂ makes a flame last about 17 % longer."))
    imp = ex["A_solids"]["importance_auc_drop"]
    P.append(dict(title="What decides whether a solid keeps burning", badge="model", kind="Model explanation",
                  source="Solids flammability model (models/v1)",
                  text=("Air speed matters most: flames starve at very low airflow and blow off at high airflow. "
                        "Then material. Inputs ranked: " + ", ".join(sorted(imp, key=lambda k: -imp[k])) +
                        f". Each +1 % O₂ multiplies the odds of sustained burning by "
                        f"{ex['A_solids']['glass_box_odds_ratios']['+1 % O2']:.2f}.")))
    P.append(dict(title="Moon and Mars gravity", badge="gap", kind="Gap", source="All PSI combustion investigations",
                  text=GRAVITY_NOTE))
    for title_, text_, src_, url_ in PARTIAL_GRAVITY:
        P.append(dict(title=f"Partial gravity: {title_}", text=text_, source=src_ + (f", {url_}" if url_ else ""),
                      badge="gap" if title_.startswith("No partial") else "literature", kind="Partial gravity"))
    gb = gravity_bounds(K)
    P.append(dict(title="Saffire materials at 0 g and 1 g: bounding partial gravity", badge="measured",
                  kind="Partial gravity", source="Saffire I-III, NASA NTRS 20180005168, Table 1",
                  text=" ".join(f"{r.material}: microgravity {r.microgravity}; Earth {r.earth_1g}; {r.partial_gravity}."
                                for r in gb.itertuples())))
    for g in HARDWARE.values():
        P.append(dict(title=f"Shared hardware: {g['name']}", text=g["text"] + " Investigations: " + ", ".join(g["members"]),
                      source=HARDWARE_SOURCE, badge="literature", kind="Hardware"))
    P.append(dict(title="Spacesuit, Earth and Moon base atmospheres: why habitats use oxygen-rich air",
                  text=" ".join(f"{r.where}: {r.o2} O₂ at {r.psi}. {r.why}" for r in ATMOSPHERES.itertuples()),
                  source=ATMOSPHERE_SOURCE, badge="literature", kind="Atmosphere"))
    P.append(dict(title="Suppression at habitat oxygen", badge="gap", kind="Gap", source="FLEX (PSI-69)",
                  text="CO₂ and helium suppressant tests on droplet flames only go up to 25 % O₂: putting out a fire "
                       "with these agents at 30-34 % O₂ is untested."))
    for rec in RECOMMENDATIONS:
        P.append(dict(title=f"Next experiment: {rec['experiment']}", text=rec["why"], source=rec["builds_on"],
                      badge="gap", kind="Recommendation"))
    for page in sorted((ROOT / "data/raw").glob("*/*investigation_page.txt")):
        txt = page.read_text(errors="ignore")
        name = page.parent.name
        for sec in ("Objectives", "Hypothesis", "Research Impacts/Earth Benefits"):
            m = re.search(sec + r"\s*\n(.*?)(?:\n(?:Approach|Hypothesis|Research Impacts|Contact)|\Z)", txt, re.S)
            if m and len(m.group(1).strip()) > 80:
                P.append(dict(title=f"{name} investigation page: {sec.split('/')[0]}", text=" ".join(m.group(1).split())[:900],
                              source=f"NASA PSI record {name}, {link_of(name, doi_of(K, name))}", badge="literature",
                              kind="NASA investigation page"))
    return P


class Archive:
    """TF-IDF search over the corpus, with a few domain synonyms. No generative model: it returns the passages
    that answer the question, each with its source, or says the archive does not cover it."""

    def __init__(self, K: dict):
        from sklearn.feature_extraction.text import TfidfVectorizer
        self.K = K
        self.P = corpus(K)
        habitat = self.findings(0.30, 0.69, "the challenge habitat")  # in the vocabulary, not in the fixed set
        docs = [self._expand(f"{p['title']} {p['title']} {p['text']}") for p in self.P + habitat]
        from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
        stop = list(ENGLISH_STOP_WORDS | {"best", "good", "available", "guess", "way", "really", "like", "know",
                                          "tell", "use", "used", "using", "does", "did", "make", "makes"})
        self.vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words=stop, min_df=1)
        self.M = self.vec.fit_transform(docs)[:len(self.P)]

    def findings(self, x_o2: float, p: float, label: str) -> list[dict]:
        return [dict(title=tk["title"], text=f"{tk['text']} {tk['action']}" + (f" ({tk['caveat']})" if tk["caveat"] else ""),
                     source=tk["source"], badge=tk["badge"], kind=f"Finding for {label}")
                for tk in takeaways(self.K, x_o2, p)]

    @staticmethod
    def _expand(s: str) -> str:
        s = s.lower().replace("₂", "2")
        s = re.sub(r"\b([a-z]+)-(ii|iii|i|r|g|2)\b", r"\1\2 \1-\2", s)  # CFI-G -> cfig, SAME-R -> samer
        extra = [SYNONYMS[w] for w in re.findall(r"[a-z0-9]+", s) if w in SYNONYMS]
        return s + " " + " ".join(extra)

    def ask(self, q: str, k: int = 4, floor: float = 0.06, x_o2: float = 0.30, p: float = 0.69,
            label: str = "the challenge habitat") -> list[dict]:
        """Search the fixed passages plus the six findings recomputed for the chosen atmosphere."""
        from scipy.sparse import vstack
        from sklearn.metrics.pairwise import linear_kernel
        live = self.findings(x_o2, p, label)
        docs = [self._expand(f"{d['title']} {d['title']} {d['text']}") for d in live]
        M = vstack([self.M, self.vec.transform(docs)])
        allp = self.P + live
        sims = linear_kernel(self.vec.transform([self._expand(q)]), M).ravel()
        sims[len(self.P):] *= 1.2  # the findings are written to answer questions: prefer them on near-ties
        order = np.argsort(-sims)[:k]
        return [dict(allp[i], score=float(sims[i])) for i in order if sims[i] >= floor]


# -------------------------------------------------------------------------------------------- briefing
def briefing_html(K: dict, mission_label: str, x_o2: float, p: float, ranking: pd.DataFrame,
                  gaps: pd.DataFrame, recs: list[dict]) -> str:
    """A one-page, self-contained HTML mission fire-safety briefing (prints cleanly to PDF)."""
    e = html.escape
    tks = takeaways(K, x_o2, p)
    badge_txt = dict(measured="NASA measurement", model="Model prediction", literature="NASA literature", gap="Data gap")
    cards = "".join(
        f"<div class='card'><div class='badge {t['badge']}'>{badge_txt[t['badge']]}</div><div class='num'>{e(t['number'])}</div>"
        f"<h3>{e(t['title'])}</h3><p>{e(t['text'])}</p><p class='act'>→ {e(t['action'])}</p>"
        + (f"<p class='cav'>⚠ {e(t['caveat'])}</p>" if t["caveat"] else "")
        + f"<p class='src'>Source: {e(t['source'])}</p></div>" for t in tks)
    top = ranking.head(6)
    rrows = "".join(f"<tr><td>{r['rank']}</td><td>{e(str(r['acronym']))} ({e(r['psi_id'])})</td><td>{r['relevance']:.0f}</td>"
                    f"<td>{e(r['why'])}</td></tr>" for _, r in top.iterrows())
    grows = "".join(f"<tr><td>{e(g.fire_type)}</td><td>{e(g.status)}</td><td>{g.tests_near_mission} of {g.tests_total}</td>"
                    f"<td>{e(g.o2_range)}, {e(g.pressure_range)}</td></tr>" for _, g in gaps.iterrows())
    pgl = "".join(f"<li><b>{e(t_)}.</b> {e(x_)} <span class='src'>Source: {e(s_)}{(' · ' + e(u_)) if u_ else ''}</span></li>"
                  for t_, x_, s_, u_ in PARTIAL_GRAVITY)
    recl = "".join(f"<li><b>{e(r['experiment'])}.</b> {e(r['why'])}</li>" for r in recs)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Fire-safety briefing: {e(mission_label)}</title>
<style>
body{{font-family:Inter,Arial,sans-serif;color:#14213d;background:#fbfaf7;margin:0;padding:32px 40px;line-height:1.45}}
h1{{font-size:26px;margin:0}} h2{{font-size:18px;margin:28px 0 10px;border-bottom:2px solid #e2ddd2;padding-bottom:4px}}
.sub{{color:#4a5568;margin:4px 0 0}} .grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}}
.card{{background:#fff;border:1px solid #e2ddd2;border-radius:10px;padding:14px}} .card h3{{font-size:15px;margin:4px 0}}
.card p{{font-size:13px;margin:6px 0}} .num{{font-size:24px;font-weight:700;color:#b8441a}}
.act{{font-weight:600}} .cav{{color:#8a5a00}} .src{{color:#5b6573;font-size:12px}}
.badge{{display:inline-block;font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px}}
.measured{{background:#dcefdc;color:#1f6b2a}} .model{{background:#dbe8f8;color:#1d4f91}}
.literature{{background:#ece3f5;color:#5b2d82}} .gap{{background:#f7dcdc;color:#a32020}}
table{{border-collapse:collapse;width:100%;font-size:13px}} td,th{{border-bottom:1px solid #e2ddd2;padding:6px;text-align:left;vertical-align:top}}
.note{{background:#fff3d6;border-radius:8px;padding:10px 12px;font-size:13px}} footer{{margin-top:28px;font-size:12px;color:#5b6573}}
@media print{{body{{padding:12px}} .grid{{grid-template-columns:repeat(2,1fr)}}}}
</style></head><body>
<h1>Fire-safety briefing: {e(mission_label)}</h1>
<p class="sub">{x_o2:.1%} O₂ · {p:.2f} atm ({p * 101.325:.1f} kPa, {p / PSIA:.1f} psia) · O₂ partial pressure {x_o2 * p:.3f} atm · generated {now} by Flame in Freefall</p>
<p class="note">{e(GRAVITY_NOTE)}</p>
<h2>What the crew and designers should know</h2><div class="grid">{cards}</div>
<h2>Most relevant NASA investigations for this atmosphere</h2>
<table><tr><th>#</th><th>Investigation</th><th>Score /100</th><th>Why</th></tr>{rrows}</table>
<h2>What has been tested near this atmosphere (±5 % O₂, ±0.2 atm)</h2>
<table><tr><th>Fire type</th><th>Status</th><th>Tests near</th><th>Tested range</th></tr>{grows}</table>
<h2>Moon and Mars gravity</h2><ul>{pgl}</ul>
<h2>Recommended next experiments</h2><ol>{recl}</ol>
<footer>Evidence labels: NASA measurement = a NASA test result; Model prediction = our model trained on NASA tests, validated
on tests it never saw; NASA literature = statement from a NASA investigation page; Data gap = not covered.
Data: NASA Physical Sciences Informatics (CC0) and NASA technical reports. Code, data and method: {REPO_URL}.
Screening tool for research and design discussion, not a certification method. Built with AI assistance (declared in the repository).</footer>
</body></html>"""


# ------------------------------------------------------------------------- hardware, sensors, variables
# Hardware families as described in the challenge brief (NASA Space Apps 2026, "Flame in Freefall").
HARDWARE = {
    "acme": dict(name="ACME modular hardware in the Combustion Integrated Rack (CIR)",
                 short="ACME hardware, CIR", members=["PSI-20", "PSI-159", "PSI-21", "PSI-10", "PSI-23", "PSI-22"],
                 text="The six ACME experiments all burned gaseous fuels with the same modular ACME hardware in the "
                      "CIR, so their conditions and diagnostics are directly comparable."),
    "mdca": dict(name="Multi-user Droplet Combustion Apparatus (MDCA) in the CIR", short="MDCA droplet rig, CIR",
                 members=["PSI-69", "PSI-68", "PSI-39"],
                 text="FLEX, FLEX-2 and the Cool Flames Investigation burned single liquid-fuel droplets in the same "
                      "apparatus."),
    "msg_duct": dict(name="Microgravity Science Glovebox (MSG) with the fan-driven flow duct built for SPICE",
                     short="MSG + SPICE flow duct", members=["PSI-26", "PSI-25", "PSI-107", "PSI-106"],
                     text="BASS, BASS-II, SPICE and SLICE shared one modular fan-driven duct in the glovebox, so solid "
                          "and gas flames were burned in the same controlled air flow. The duct is 76 mm × 76 mm in "
                          "cross-section (Ferkul et al. 2013)."),
    "msg_smoke": dict(name="Microgravity Science Glovebox (MSG) with the SAME smoke hardware",
                      short="MSG, SAME smoke hardware", members=["PSI-102", "PSI-101"],
                      text="SAME and SAME-R heated materials until they smoked and passed the smoke to detectors. One "
                           "of their smoke instruments, a modified P-Trak, was first checked in the Dust "
                           "and Aerosol Measurement Feasibility Tests (DAFT and DAFT-2), which measured dust instead "
                           "of smoke (challenge brief; NASA Glenn Combustion Science page)."),
    "saffire": dict(name="Saffire flight unit inside an empty Cygnus cargo vehicle", short="Saffire unit, Cygnus",
                    members=["PSI-98", "PSI-99", "PSI-100", "EXT-SAFFIRE-456"],
                    text="Large samples burned in a flow tunnel inside Cygnus after it left the ISS, so a real "
                         "spacecraft-sized fire could be studied without risk to a crew."),
}
HW_OF = {psi: k for k, g in HARDWARE.items() for psi in g["members"]}
HARDWARE_SOURCE = ("NASA Space Apps 2026 challenge brief; Ferkul et al. 2013 (BASS duct); PSI investigation pages; "
                   "catalog/investigations.csv")


def derived_from(K: dict, psi: str) -> str:
    """Analysis or model investigations: which flight data they build on (catalog column derived_from)."""
    c = K["cat"]
    v = c.loc[c.psi_id == psi, "derived_from"].dropna()
    return str(v.iloc[0]) if len(v) else ""


def hardware_text(K: dict, psi: str) -> str:
    if psi in HW_OF:
        return HARDWARE[HW_OF[psi]]["name"]
    d = derived_from(K, psi)
    plat = K["cat"].loc[K["cat"].psi_id == psi, "platform"].dropna()
    base = str(plat.iloc[0]) if len(plat) else "not listed"
    return f"{base}; builds on data from {d}" if d else base

# Instruments named on each NASA investigation page (data/raw/<id>/*_investigation_page.txt) or source report.
SENSORS = {
    "PSI-98": "two video cameras; thermocouples for flow, flame and plume temperature; two radiometers; solid-state "
              "pressure, CO₂ and O₂ sensors; two anemometers (investigation page)",
    "PSI-100": "camera images are the raw data PSI publishes for this investigation (PSI page)",
    "PSI-26": "digital still camera through the top window (about 1 frame/s), video camera through the front window "
              "(30 frames/s), hot-wire anemometer for flow speed, wide-angle radiometer inside the duct "
              "(Ferkul et al. 2013)",
    "PSI-25": "video with flow speed, fan and radiometer overlay; Nikon D300s still camera; O₂ sensor; CDM CO₂ "
              "sensor and CSA-CP CO analyser (BASS-II data FAQ and science requirements document)",
    "EXT-SAFFIRE-456": "Saffire flight unit; far-field CO₂ and CO sensors used for the cabin-air results "
                       "(Urban et al. 2024, Table 2)",
    "PSI-102": "two smoke detectors, video cameras, thermophoretic samplers whose particles were sized by TEM after "
               "flight (investigation page)",
    "PSI-101": "the SAME instruments plus a new in-house instrument (M-pass); clean TEM grids after SAME's "
               "contamination (investigation page)",
    "PSI-159": "cameras, radiometers, photomultiplier tubes (PMTs) and thermocouples (investigation page)",
    "PSI-20": "heat-flux sensor and burner surface temperature (investigation page)",
    "PSI-68": "colour camera video; chamber pressure and temperature (investigation page)",
    "PSI-69": "droplet imaging for burning rate and extinction size, heat radiation, soot and temperature "
              "(investigation page goals)",
    "PSI-106": "over 4,000 high-resolution flame images over 13 test days (investigation page)",
}

# Extra context from the challenge brief, shown with the investigation.
CONTEXT = {
    "PSI-159": "CFI-G ran the highest oxygen levels in microgravity: in inverse flames an oxygen-nitrogen mix of up "
               "to 85 % O₂ flowed from the burner into a chamber of nitrogen and fuel. Our table holds only the "
               "normal flames (fuel from the burner, 18-40 % O₂ around it), which is the cabin-like case.",
    "PSI-20": "Although it burned gas, BRE is a materials-flammability study: the burner imitates a burning solid, "
              "in still air, as a function of material properties.",
    "PSI-22": "Electric fields act on the ions that occur naturally in flames, which lets this experiment mimic "
              "partial gravity: the closest PSI comes to Moon or Mars conditions.",
    "PSI-102": "One SAME instrument, a modified P-Trak, was used to measure dust in DAFT and DAFT-2.",
    "PSI-101": "One SAME instrument, a modified P-Trak, was used to measure dust in DAFT and DAFT-2.",
}

# Columns that can vary between tests of one investigation, with how to show them.
_VARS = [("fuel", "fuel or material", None), ("geometry", "sample or burner shape", None),
         ("x_o2", "O₂", "{:.0%}"), ("pressure_atm", "pressure", "{:.2f} atm"), ("flow_cm_s", "air speed", "{:.0f} cm/s"),
         ("flow_direction", "flow direction", None), ("d0_mm", "droplet size", "{:.1f} mm"),
         ("thickness_mm", "thickness", "{:.2f} mm"), ("diameter_mm", "diameter", "{:.1f} mm"),
         ("sample_width_cm", "sample width", "{:.0f} cm"),
         ("x_co2", "CO₂ added", "{:.0%}"), ("x_he", "helium added", "{:.0%}"),
         ("fuel_mole_fraction", "fuel dilution", "{:.0%}"), ("fuel_flow_mg_s", "fuel flow", "{:.2f} mg/s"), ("ignition_power_w", "igniter power", "{:.0f} W"),
         ("heating_duration_s", "heating time", "{:.0f} s"), ("primary_aging_s", "smoke aging time", "{:.0f} s"),
         ("t_ambient_k", "ambient temperature", "{:.0f} K")]


def _fmt_vals(v: pd.Series, fmt: str | None) -> str:
    u = v.dropna()
    if fmt is None:
        vals = sorted(set(u.astype(str).str.replace(r"\s*\(.*\)", "", regex=True)))
        return ", ".join(vals[:4]) + (f" (+{len(vals) - 4} more)" if len(vals) > 4 else "")
    lo, hi = fmt.format(u.min()), fmt.format(u.max())
    if lo == hi and u.max() > u.min() and "%}" in fmt:
        lo, hi = fmt.replace(":.0%", ":.1%").format(u.min()), fmt.replace(":.0%", ":.1%").format(u.max())
    return lo if lo == hi else f"{lo} to {hi}"


def variables(K: dict, psi: str) -> dict:
    """What changed between the microgravity tests of one investigation and what was held the same."""
    t = K["tests"]
    s = t[(t.investigation_id == psi) & (t.gravity_g.fillna(0) == 0)]
    if "exclude" in s:
        s = s[~s.exclude.astype("boolean").fillna(False).astype(bool)]
    varied, same = [], []
    if not len(s):
        return dict(varied=[], same=[], n=0)
    for col, lab, fmt in _VARS:
        if col not in s or s[col].notna().sum() == 0:
            continue
        u = s[col].dropna()
        nun = u.round(4).nunique() if fmt else u.astype(str).nunique()
        if col in ("x_co2", "x_he") and u.max() == 0:
            continue
        (varied if nun > 1 else same).append(f"{lab}: {_fmt_vals(u, fmt)}" + (f" ({nun} values)" if nun > 1 and fmt else ""))
    return dict(varied=varied, same=same, n=len(s))


def sample_text(K: dict, psi: str) -> str:
    """Sample or burner shape and size, from the test table or the catalog."""
    t, c = K["tests"], K["cat"]
    s = t[(t.investigation_id == psi) & (t.gravity_g.fillna(0) == 0)]
    parts = []
    if len(s) and s.geometry.notna().any():
        parts.append(_fmt_vals(s.geometry, None))
    for col, lab, fmt in (("thickness_mm", "thickness", "{:.2f} mm"), ("d0_mm", "initial droplet diameter", "{:.1f} mm"),
                          ("diameter_mm", "diameter", "{:.1f} mm"), ("sample_width_cm", "width", "{:.0f} cm"),
                          ("sample_length_cm", "length", "{:.0f} cm"), ("size_mm", "size", "{:.1f} mm")):
        if len(s) and col in s and s[col].notna().any():
            if col == "size_mm" and len(parts) > 1:
                continue
            parts.append(f"{lab} {_fmt_vals(s[col], fmt)}")
    if not parts:
        g = c.loc[c.psi_id == psi, "geometry"].dropna()
        parts.append(str(g.iloc[0]) + " (PSI listing)" if len(g) else "not listed")
    return "; ".join(parts)


def measurements_text(K: dict, psi: str) -> str:
    """Instruments from the NASA page where named, otherwise the measurements listed in the catalog."""
    c = K["cat"]
    km = c.loc[c.psi_id == psi, "key_measurements"].dropna()
    meas = str(km.iloc[0]) if len(km) else ""
    sens = SENSORS.get(psi, "")
    if sens and meas:
        return f"{meas}. Instruments: {sens}"
    return sens or meas or "not listed"


def compare_summary(inv: pd.DataFrame, ids: list[str]) -> tuple[list[str], list[str]]:
    """Plain-language similarities and differences between two or three investigations."""
    r = inv.set_index("psi_id").loc[ids]
    same, diff = [], []
    hw = [HW_OF.get(i) for i in ids]
    if hw[0] and len(set(hw)) == 1:
        same.append(f"same hardware ({HARDWARE[hw[0]]['short']}), so conditions and diagnostics are directly comparable")
    else:
        diff.append("different hardware: " + "; ".join(f"{r.at[i, 'acronym']} used {HARDWARE[h]['short'] if h else 'its own setup'}"
                                                       for i, h in zip(ids, hw)))
    ft = r.fire_type.tolist()
    (same if len(set(ft)) == 1 else diff).append(
        f"fire type: {ft[0].split(' (')[0].lower()}" if len(set(ft)) == 1 else
        "fire type: " + "; ".join(f"{r.at[i, 'acronym']} {r.at[i, 'fire_type'].split(' (')[0].lower()}" for i in ids))
    o2 = r.o2_tested.tolist()
    (same if len(set(o2)) == 1 else diff).append("O₂ tested: " + ("; ".join(f"{r.at[i, 'acronym']} {r.at[i, 'o2_tested']}" for i in ids)
                                                                if len(set(o2)) > 1 else o2[0]))
    areas = [set(a.replace(" ", "").split(",")) - {""} for a in r.area]
    common = set.intersection(*areas) if areas else set()
    if common:
        same.append("safety need: " + ", ".join(sorted(common)))
    return same, diff


ATMOSPHERES = pd.DataFrame([
    dict(where="Earth, sea level (and the ISS)", o2="21 %", psi="14.7 psi", atm=1.00, ppo2=0.21,
         why="Normal air."),
    dict(where="Spacesuit", o2="100 %", psi="4.3 psi", atm=round(4.3 * PSIA, 2), ppo2=round(4.3 * PSIA, 2),
         why="Low pressure keeps the suit flexible; astronauts pre-breathe pure O₂ first to purge nitrogen and avoid the bends."),
    dict(where="Moon base and pressurized rovers (expected)", o2="30 % or more", psi="10.2 psi or less",
         atm=round(10.2 * PSIA, 2), ppo2=round(0.30 * 10.2 * PSIA, 2),
         why="Between suit and Earth air, to shorten pre-breathing before moonwalks. Over 40 % more oxygen "
             "fraction than Earth air (30/21 = 1.43), so materials burn more readily."),
])
ATMOSPHERE_SOURCE = "NASA Space Apps 2026 challenge brief (Flame in Freefall); NASA atmospheres in ACME BRE (PSI-20)"

NTRS_LUCI = "https://ntrs.nasa.gov/citations/20250010653"
NASA_COMBUSTION = "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"
NTRS_FM2 = "https://ntrs.nasa.gov/citations/20240015307"
NASA_FM2 = "https://www.nasa.gov/flammability-of-materials-on-the-moon-fm2/"
# (title, text, source label, url)
PARTIAL_GRAVITY = [
    ("No partial-gravity fire data in PSI yet",
     "No PSI combustion investigation has burned anything at lunar (0.16 g) or Martian (0.38 g) gravity. NASA "
     "expects such data from the Lunar-g Combustion Investigation (LUCI) and Flammability of Materials on the Moon (FM2).",
     "Challenge brief", ""),
    ("LUCI: simulated lunar gravity on a sounding rocket",
     "LUCI burned a cotton-fiberglass (SIBAL) fabric and a 4 mm acrylic (PMMA) rod in air at normal pressure while "
     "the Blue Origin New Shepard capsule spun at about 11 rpm to imitate lunar gravity: the first extended "
     "(over 25 s) burns in simulated lunar gravity. The acrylic flame tip spread at about 1.5 mm/s. Results are "
     "in NASA presentations, not in PSI.",
     "Ferkul et al., NTRS 20250010653 (2025)", NTRS_LUCI),
    ("FM2: the first fire experiment on the Moon",
     "FM2 will burn four samples, one at a time, in atmospheres planned for lunar habitats, with cameras and "
     "temperature, O₂ and CO₂ sensors. Drop-tower centrifuge tests behind it found that some materials burn at "
     "lower oxygen levels in lunar gravity than on Earth: less heat loss than at 1 g, yet enough buoyant flow to "
     "feed the flame.",
     "NASA FM2 page; Zayac et al., NTRS 20240015307 (2024)", NASA_FM2),
    ("Mimicked partial gravity: ACME E-FIELD Flames (PSI-22)",
     "Electric fields acting on the ions in a flame can imitate buoyancy, so E-FIELD Flames is the closest PSI "
     "comes to partial gravity. Its per-test data are not loaded here.",
     "Challenge brief", ""),
    ("Bounding with 0 g and 1 g, and its limit",
     "Microgravity and Earth results can bracket intermediate gravity: where a material behaves the same at both, "
     "that is the best available guess for the Moon. But the FM2 work shows the bracket is not always safe, since "
     "some materials are most flammable at lunar gravity. Materials whose 0 g and 1 g results disagree should be "
     "tested first.",
     "Challenge brief; Zayac et al., NTRS 20240015307", NTRS_FM2),
]


def gravity_bounds(K: dict) -> pd.DataFrame:
    """Saffire I-III materials burned in microgravity and in NASA's 1 g companion tests (NTRS 20180005168,
    Table 1, 1 g columns): do the two bounds agree?"""
    t, ev = K["tests"], K["ev"]
    s = t[t.investigation_id.isin(["PSI-98", "PSI-99", "PSI-100"])].copy()
    s["material"] = s.fuel.str.replace(r"\s*\(.*\)", "", regex=True)
    q = ev[ev.investigation_id.isin(["PSI-98", "PSI-99", "PSI-100"])]
    spread = q[q.quantity == "flame_spread_rate"].groupby("test_id").value.max()
    length = q[q.quantity == "burn_length"].groupby("test_id").value.max()
    s["spread"] = s.test_id.map(spread)
    s["length"] = s.test_id.map(length)

    def burned(r):
        if r.ignited is True or r.ignited == "True" or (pd.notna(r.spread) and r.spread > 0):
            return True
        if pd.notna(r.length):
            return bool(r.length > 0)
        if isinstance(r.outcome_note, str) and "not ignited" in r.outcome_note:
            return False
        return None

    s["burned"] = s.apply(burned, axis=1)
    rows = []
    for mat, g in s.groupby("material"):
        out = {}
        for gv, lab in ((0.0, "0g"), (1.0, "1g")):
            h = g[g.gravity_g == gv]
            k = h.burned.dropna()
            sp = h.spread.dropna()
            txt = (f"burned in {int(k.sum())} of {len(k)}" if len(k) else "no result recorded")
            if len(sp):
                txt += f"; spread {sp.min():.1f}" + (f"-{sp.max():.1f}" if sp.max() > sp.min() else "") + " mm/s"
            if gv == 1.0 and h.outcome_note.astype(str).str.contains("acceleratory").any():
                txt += "; spread kept accelerating"
            out[lab] = (txt, (k.mean() if len(k) else None))
        f0, f1 = out["0g"][1], out["1g"][1]
        if f0 is None or f1 is None:
            verdict = "not enough results"
        elif (f0 > 0) == (f1 > 0):
            verdict = "bounds agree: " + ("burns at any gravity" if f0 > 0 else "did not burn at either")
        else:
            verdict = "bounds disagree: partial gravity unknown, test it first"
        rows.append(dict(material=mat, microgravity=out["0g"][0], earth_1g=out["1g"][0], partial_gravity=verdict))
    return pd.DataFrame(rows)
