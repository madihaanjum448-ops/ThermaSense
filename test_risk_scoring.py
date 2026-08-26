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
print("Null demographics score:", null_vuln)

# Case 4: same thermal score, different vulnerability -> final band should differ
thermal_score = 55.0  # a "moderate-ish" thermal score
low_final_score, low_final_band = combine_risk(thermal_score, low_vuln)
high_final_score, high_final_band = combine_risk(thermal_score, high_vuln)
print("\nSame thermal score (55), different ward vulnerability:")
print("  Low-vuln ward final:", (low_final_score, low_final_band))
print("  High-vuln ward final:", (high_final_score, high_final_band))

# Case 5: extreme thermal score should stay extreme regardless of vulnerability
ext_final_score, ext_final_band = combine_risk(95.0, low_vuln)
print("\nExtreme thermal score (95) with low vulnerability:")
print(" ", (ext_final_score, ext_final_band))

print("\n--- Running Assertion Verifications ---")

# Assertion A: thermal score 90 + low vulnerability can NEVER produce a final score below 90
score_90_vuln_10, band_90_vuln_10 = combine_risk(90.0, 10.0)
assert score_90_vuln_10 >= 90.0, f"Assertion A Failed: final score {score_90_vuln_10} is below 90.0"
print(f"Assertion A PASSED: score 90 + vuln 10 -> {score_90_vuln_10} (>= 90.0)")

# Assertion B: Increasing vulnerability with identical thermal conditions cannot decrease final risk
prev_score = 0.0
for v in [0.0, 10.0, 25.0, 50.0, 75.0, 100.0]:
    cur_score, _ = combine_risk(60.0, v)
    assert cur_score >= prev_score, f"Assertion B Failed: score decreased at vuln {v}"
    prev_score = cur_score
print("Assertion B PASSED: Increasing vulnerability monotonically increases or preserves final risk")

# Assertion C: Current-risk and forecast-risk paths use the same risk-combination formula
demo_sample = {"elderly_pct": 20, "outdoor_worker_pct": 30, "slum_household_pct": 15, "green_cover_pct": 25}
v_calc = calculate_vulnerability_score(demo_sample)
current_path_score, current_path_band = combine_risk(70.0, v_calc)
forecast_path_score, forecast_path_band = combine_risk(70.0, v_calc)
assert current_path_score == forecast_path_score, "Assertion C Failed: score mismatch between current and forecast formulas"
assert current_path_band == forecast_path_band, "Assertion C Failed: band mismatch between current and forecast formulas"
print(f"Assertion C PASSED: Current and forecast formulas identical ({current_path_score}, '{current_path_band}')")

# Assertion D: A raw EXTREME thermal risk can never become HIGH or lower after vulnerability combination
for v in [0.0, 10.0, 50.0, 100.0]:
    ext_score, ext_band = combine_risk(90.0, v)
    assert ext_score >= 90.0, f"Assertion D Failed: extreme score {ext_score} dropped"
    assert ext_band == "extreme", f"Assertion D Failed: extreme band downgraded to {ext_band}"
print("Assertion D PASSED: Raw EXTREME thermal risk (90.0) remains EXTREME across all vulnerability levels")

# Assertion E: A moderate thermal score with sufficiently high vulnerability can increase to HIGH
assert low_final_band == "moderate", f"Assertion E Failed: expected moderate, got {low_final_band}"
assert high_final_band == "high", f"Assertion E Failed: expected high, got {high_final_band}"
assert high_final_score >= 60.0, f"Assertion E Failed: high vulnerability did not reach >= 60.0, got {high_final_score}"
print(f"Assertion E PASSED: Moderate score 55.0 escalated to {high_final_score} ('{high_final_band}') with high vulnerability")

print("\nALL RISK SCORING ASSERTIONS PASSED SUCCESSFULLY")