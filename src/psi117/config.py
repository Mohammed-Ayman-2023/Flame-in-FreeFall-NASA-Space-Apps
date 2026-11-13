"""Paths, file names and the corrected test-condition catalog for PSI-117.

Everything that is a *decision* (a correction, an assumption, an interpretation)
lives here so it is visible in one place and easy to change.
"""
from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------- paths
ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "PSI-117"
PROCESSED = ROOT / "data" / "processed" / "PSI-117"
REPORTS = ROOT / "reports" / "PSI-117"
FIGURES = REPORTS / "figures"

# ---------------------------------------------------------------- raw files
FILES = {
    "readme": "PSI-117_Analyzed_Data_ReadMe_List_of_Data_2.xlsx",
    "heptane_stable": "PSI-117_Analyzed_Data_PROCI_2019_Stable_Cool.csv",
    "heptane_oscillatory": "PSI-117_Analyzed_Data_PROCI_2019_Oscillatory_Cool_Flame_1.csv",
    "c12_three_stage": "PSI-117_Analyzed_Data_PROCI_C12_2019_Three_Stage.csv",
    "alkane_dext_1atm": "PSI-117_Analyzed_Data_PROCI_2023_Alkane_Extinction_Diameter_1atm_2.csv",
    "c12_dext_vs_p": "PSI-117_Analyzed_Data_PROCI_2023_C12_Extinction_Diameter_vs_pressure.csv",
    "c12_kavg": "PSI-117_Analyzed_Data_MST_2024_Kavg.csv",
    "dissertation": "PSI-117_Reports_Dissertation_Combustion_Behavior_Of_Sub-Millimeter_Sized_Oxygenated_And_N-Alka.pdf",
}

# Data files the ReadMe lists but that were not in the upload.
MISSING_FROM_UPLOAD = [
    "MST_2024_Burning_history_Flame_diameter",
    "MST_2024_Dext",
    "MST_2024_Radiance_Flame_Diameter",
]

# ---------------------------------------------------------------- stage thresholds
# Peak gas temperature bands used to label burning stages. Anchors come from
# Farouk, Dietrich & Dryer, Proc. Combust. Inst. 37 (2019) 3353: hot ~1500 K,
# warm ~970 K, cool ~765 K. The cut points sit between those anchors.
HOT_MIN_K = 1200.0
WARM_MIN_K = 870.0

# A ratio such as D_Tmax/D_drop is divided by the droplet diameter, so it
# explodes as the droplet vanishes. Below this D/D0 the ratio is masked.
RATIO_MASK_BELOW_D_OVER_D0 = 0.10

# ---------------------------------------------------------------- conditions
# One row per dataset. Values come from the ReadMe workbook, corrected where the
# workbook is internally inconsistent; every correction is recorded in `notes`
# and cited to its source.
CATALOG = [
    dict(
        dataset_id="heptane_stable",
        data_file="PROCI_2019_Stable_Cool",
        available=True,
        source_type="simulation",
        fuel="n-heptane",
        d0_mm=0.5,
        pressure_atm=1.0,
        x_o2=0.21, x_n2=0.74, x_he=0.0, x_o3=0.05,
        t_ambient_k=298.0,
        doi="10.1016/j.proci.2018.05.151",
        reference="Alam, Aghdam, Dryer & Farouk, Proc. Combust. Inst. 37 (2019) 3383-3391",
        figure="Fig. 1",
        notes=(
            "ReadMe lists XN2=74 and XO3='Balance'. Dissertation ch.7 (Alam 2018) states the "
            "runs use XO3=5% with balance N2, at 1 atm and 298 K, so XO3=0.05 and XN2=0.74. "
            "Computational study (1-D spherically symmetric droplet model)."
        ),
    ),
    dict(
        dataset_id="heptane_oscillatory",
        data_file="PROCI_2019_Oscillatory_Cool_Flame",
        available=True,
        source_type="simulation",
        fuel="n-heptane",
        d0_mm=0.5,
        pressure_atm=1.0,
        x_o2=0.10, x_n2=0.85, x_he=0.0, x_o3=0.05,
        t_ambient_k=298.0,
        doi="10.1016/j.proci.2018.05.151",
        reference="Alam, Aghdam, Dryer & Farouk, Proc. Combust. Inst. 37 (2019) 3383-3391",
        figure="Fig. 1",
        notes=(
            "ReadMe lists XN2=85 and XO3='Balance'. Dissertation ch.7: base case XO2=10%, "
            "XO3=5%, balance N2 (near-limit, oscillatory cool flame). Corrected to fractions."
        ),
    ),
    dict(
        dataset_id="c12_three_stage",
        data_file="PROCI_C12_2019_Three_Stage",
        available=True,
        source_type="experiment+simulation",
        fuel="n-dodecane",
        d0_mm=4.5,
        pressure_atm=2.75,
        x_o2=0.21, x_n2=0.50, x_he=0.29, x_o3=0.0,
        t_ambient_k=298.0,
        doi="10.1016/j.proci.2018.09.015",
        reference="Farouk, Dietrich & Dryer, Proc. Combust. Inst. 37 (2019) 3353-3361",
        figure="Fig. 7",
        notes=(
            "ReadMe d0=4.5 mm matches the simulation's initial diameter. The paper's Fig. 7 "
            "caption gives the experiment (FLEX 1268) as d0=4.35 mm. Experiment curves were "
            "digitized against t/d0^2, so they are unaffected; the 4.35 mm value is used "
            "only when converting experiment ratios to mm."
        ),
    ),
    dict(
        dataset_id="alkane_dext_1atm",
        data_file="PROCI_2023_Alkane_Extinction_Diameter_1atm",
        available=True,
        source_type="experiment+simulation",
        fuel="n-heptane, n-decane, n-dodecane",
        d0_mm="2.0-7.0",
        pressure_atm=1.0,
        x_o2=0.21, x_n2=0.79, x_he=0.0, x_o3=0.0,
        t_ambient_k=298.0,
        doi="10.1016/j.proci.2022.07.094",
        reference="Farouk & Dryer, Proc. Combust. Inst. 39 (2023) 2471-2481",
        figure="Fig. 3",
        notes="Zero extinction diameters are sentinels (no extinction / not observed), not measurements.",
    ),
    dict(
        dataset_id="c12_dext_vs_p",
        data_file="PROCI_2023_C12_Extinction_Diameter_vs_pressure",
        available=True,
        source_type="experiment+simulation",
        fuel="n-dodecane",
        d0_mm=4.0,
        pressure_atm="0.5-3.0",
        x_o2=0.21, x_n2=0.79, x_he=0.0, x_o3=0.0,
        t_ambient_k=298.0,
        doi="10.1016/j.proci.2022.07.094",
        reference="Farouk & Dryer, Proc. Combust. Inst. 39 (2023) 2471-2481",
        figure="Fig. 7",
        notes=(
            "Columns 'Dext_CF_ErrorBar+/-' are read as absolute upper/lower bounds in mm "
            "(read as offsets they would put the bound above the hot-flame diameter). "
            "Interpretation to be confirmed against the paper's Fig. 7."
        ),
    ),
    dict(
        dataset_id="c12_kavg",
        data_file="MST_2024_Kavg",
        available=True,
        source_type="experiment+simulation",
        fuel="n-dodecane",
        d0_mm=4.5,
        pressure_atm="0.5-5.0",
        x_o2=0.21, x_n2=0.79, x_he=0.0, x_o3=0.0,
        t_ambient_k=298.0,
        doi="10.1007/s12217-024-10115-x",
        reference="Dietrich, Krause, Nayagam, Farouk, Dryer & Williams, Microgravity Sci. Technol. (2024)",
        figure="Fig. 4",
        notes="Kavg_CF = average cool-flame burning rate (mm^2/s); model column kb.",
    ),
] + [
    dict(
        dataset_id=name.lower(), data_file=name, available=False, source_type="unknown",
        fuel="n-dodecane", d0_mm=d0, pressure_atm=p, x_o2=0.21, x_n2=0.79,
        x_he=0.0, x_o3=0.0, t_ambient_k=None, doi="10.1007/s12217-024-10115-x",
        reference="Dietrich et al., Microgravity Sci. Technol. (2024)", figure=fig,
        notes="Listed in the ReadMe but not in the uploaded files.",
    )
    for name, d0, p, fig in [
        ("MST_2024_Burning_history_Flame_diameter", 4.0, 1.0, "Fig. 1"),
        ("MST_2024_Dext", 4.0, "0.5-1.5", "Fig. 5"),
        ("MST_2024_Radiance_Flame_Diameter", "~4.5", "0.5 and 5.0", "Fig. 11"),
    ]
]

# Initial diameter of the FLEX 1268 experiment (paper Fig. 7 caption).
C12_THREE_STAGE_EXPT_D0_MM = 4.35
C12_THREE_STAGE_SIM_D0_MM = 4.5
