from risk_scoring import calculate_vulnerability_score, combine_risk

# Case 1: low-vulnerability ward (young population, good green cover)
low_vuln = calculate_vulnerability_score({
    "elderly_pct": 5, "outdoor_worker_pct": 8,
    "slum_household_pct": 3, "green_cover_pct": 40,
})
print("Low vulnerability ward score:", low_vuln)

# Case 2: high-vulnerability ward (elderly, outdoor workers, slum housing, no green cover)
high_vuln = calculate_vulnerability_score({
    "elderly_pct": 25, "outdoor_worker_pct": 40,
    "slum_household_pct": 35, "green_cover_pct": 5,
})
print("High vulnerability ward score:", high_vuln)

# Case 3: missing/null demographics — should not crash, should default sensibly
null_vuln = calculate_vulnerability_score({
    "elderly_pct": None, "outdoor_worker_pct": None,
    "slum_household_pct": None, "green_cover_pct": None,
})
print("Null demographics score (should be ~85, since green_cover=0 -> deficit=100):", null_vuln)

# Case 4: same thermal score, different vulnerability -> final band should differ
thermal_score = 55.0  # a "moderate-ish" thermal score
print("\nSame thermal score (55), different ward vulnerability:")
print("  Low-vuln ward final:", combine_risk(thermal_score, low_vuln))
print("  High-vuln ward final:", combine_risk(thermal_score, high_vuln))

# Case 5: extreme thermal score should stay extreme regardless of vulnerability
print("\nExtreme thermal score (95) with low vulnerability:")
print(" ", combine_risk(95.0, low_vuln))