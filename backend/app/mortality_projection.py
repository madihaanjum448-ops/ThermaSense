# mortality_projection.py
"""mortality_projection.py

Provides a deterministic excess‑mortality rate projection based on the
dose‑response relationship reported in:

- **Title**: Heat‑Related Mortality in India: Excess All‑Cause Mortality Associated with the 2010 Ahmedabad Heat Wave
- **Authors**: Gulrez Shah Azhar et al.
- **Journal**: PLOS ONE
- **Year**: 2014
- **DOI**: 10.1371/journal.pone.0091831

The paper reports a mortality **rate ratio (RR)** of **1.76** for the
extreme‑heat period, which corresponds to a **76 % excess mortality** (RR−1 = 0.76)
when the **ambient max temperature** exceeds **45 °C**.  This is a *single
historical‑event* result; there is no continuous dose‑response curve.

This module implements a **binary‑triggered** projection:
  * If the ambient temperature is ≥ 45 °C, the base excess‑mortality **rate**
    is **0.76** (i.e. 76 % relative increase over baseline deaths).
  * The rate may be scaled by a demographic `vulnerability_score` (0‑1).
  * The returned value is a **rate multiplier** (0‑1), *not* a percent of the
    ward population.
"""

from typing import Optional

# Constants derived from the paper
EXCESS_MORTALITY_RATE = 0.76  # (RR - 1) where RR = 1.76
AMBIENT_TEMP_THRESHOLD = 45.0  # °C – ambient max‑temperature definition used in the study


def project_excess_mortality(
    ambient_temp_c: Optional[float],
    population: Optional[int],
    vulnerability_score: Optional[float] = None,
) -> float:
    """Calculate the projected excess‑mortality **rate** for a ward.

    Args:
        ambient_temp_c: Ambient temperature (°C) for the ward (latest non‑forecast reading).
        population: Total population of the ward (kept for signature compatibility – not used in the calculation).
        vulnerability_score: Optional demographic vulnerability index (0‑1).

    Returns:
        The excess‑mortality **rate** (0‑1).  ``0.0`` if the temperature is below the
        threshold or required inputs are missing.
    """
    if ambient_temp_c is None or population is None:
        return 0.0

    # No excess mortality if temperature is not extreme
    if ambient_temp_c < AMBIENT_TEMP_THRESHOLD:
        return 0.0

    # Base excess mortality rate from the paper (0.76)
    excess_rate = EXCESS_MORTALITY_RATE

    # Adjust for vulnerability if a score is available (scale between 0‑1)
    if vulnerability_score is not None:
        excess_rate *= max(0.0, min(1.0, vulnerability_score))

    return excess_rate

# ---------------------------------------------------------------------------
# Methodology strings for API inclusion – these are exported for reuse.
MORTALITY_METHODLOGY = (
    "Based on Azhar et al. 2014 (PLOS ONE, DOI:10.1371/journal.pone.0091831) "
    "which reported a mortality rate ratio of 1.76 (≈ 76 % excess mortality) "
    "during the 2010 Ahmedabad extreme‑heat period (ambient max temperature > 45 °C). "
    "This is a binary‑triggered estimate: the excess‑mortality **rate** is applied "
    "when ambient temperature ≥ 45 °C and scaled by the ward‑level vulnerability_score (0‑1). "
    "It does **not** represent a continuous dose‑response model."
)
