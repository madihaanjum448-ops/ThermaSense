"""Test Pair C alert detection and vulnerability integration."""

from datetime import datetime, timezone, timedelta
from sqlalchemy import text

from db import engine
from alert_engine import check_and_alert, create_alert, get_latest_risk, get_previous_alert
from forecast_warning_dispatcher import _warning_already_sent

TEST_WARD_ID = 9999

def setup_test_data():
    with engine.begin() as conn:
        # Cleanup any prior test run data
        conn.execute(text("DELETE FROM alerts_log WHERE ward_id = :w"), {"w": TEST_WARD_ID})
        conn.execute(text("DELETE FROM risk_scores WHERE ward_id = :w"), {"w": TEST_WARD_ID})
        conn.execute(text("DELETE FROM wards WHERE id = :w"), {"w": TEST_WARD_ID})

        # Insert test ward
        conn.execute(
            text("""
                INSERT INTO wards (id, name, city, centroid_lat, centroid_lon, elderly_pct, outdoor_worker_pct, slum_household_pct, green_cover_pct)
                VALUES (:w, 'Alert Test Ward', 'Nagpur', 21.1458, 79.0882, 25.0, 40.0, 35.0, 5.0)
                ON CONFLICT (id) DO NOTHING
            """),
            {"w": TEST_WARD_ID}
        )

def cleanup_test_data():
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM alerts_log WHERE ward_id = :w"), {"w": TEST_WARD_ID})
        conn.execute(text("DELETE FROM risk_scores WHERE ward_id = :w"), {"w": TEST_WARD_ID})
        conn.execute(text("DELETE FROM wards WHERE id = :w"), {"w": TEST_WARD_ID})

def run_tests():
    print("=== RUNNING ALERT ENGINE ASSERTION TESTS ===\n")
    setup_test_data()

    try:
        now = datetime.now(timezone.utc)

        # -------------------------------------------------------------
        # Test 1: Moderate thermal + High vulnerability -> Final HIGH -> Alert generated
        # -------------------------------------------------------------
        print("Test 1: Moderate raw thermal + High vulnerability -> final HIGH alert")
        with engine.begin() as conn:
            row1 = conn.execute(
                text("""
                    INSERT INTO risk_scores
                        (ward_id, score_time, is_forecast, heat_index_c, wbgt_c, utci_c,
                         risk_band, risk_score_raw, vulnerability_score, final_risk_score, final_risk_band, computed_at)
                    VALUES
                        (:w, :t, false, 32.0, 26.5, 30.0, 'moderate', 55.0, 42.0, 60.67, 'high', :t)
                    RETURNING id
                """),
                {"w": TEST_WARD_ID, "t": now}
            ).fetchone()
            risk_id_1 = row1[0]

        risk_1 = get_latest_risk(TEST_WARD_ID)
        assert risk_1["id"] == risk_id_1
        assert risk_1["risk_band"] == "moderate"
        assert risk_1["final_risk_band"] == "high"

        alert_res_1 = check_and_alert(TEST_WARD_ID)
        assert alert_res_1["alert_created"] is True, "Expected alert to be created for final_risk_band='high'"
        alert_id_1 = alert_res_1["alert_id"]

        with engine.connect() as conn:
            alert_row_1 = conn.execute(
                text("SELECT risk_band, message, risk_score_id FROM alerts_log WHERE id = :id"),
                {"id": alert_id_1}
            ).fetchone()

        assert alert_row_1._mapping["risk_band"] == "high", f"Expected stored alert risk_band 'high', got {alert_row_1._mapping['risk_band']}"
        assert alert_row_1._mapping["risk_score_id"] == risk_id_1, "Expected risk_score_id to match risk score row"
        assert "HIGH" in alert_row_1._mapping["message"], "Expected alert message to mention HIGH risk"
        print(f"  [PASS] Alert {alert_id_1} successfully created with risk_band='high' and risk_score_id={risk_id_1}\n")

        # -------------------------------------------------------------
        # Test 2: Duplicate Alert Prevention (Same Severity HIGH -> HIGH)
        # -------------------------------------------------------------
        print("Test 2: Duplicate Alert Prevention (HIGH -> HIGH)")
        with engine.begin() as conn:
            row2 = conn.execute(
                text("""
                    INSERT INTO risk_scores
                        (ward_id, score_time, is_forecast, heat_index_c, wbgt_c, utci_c,
                         risk_band, risk_score_raw, vulnerability_score, final_risk_score, final_risk_band, computed_at)
                    VALUES
                        (:w, :t, false, 32.5, 27.0, 30.5, 'moderate', 56.0, 42.0, 61.37, 'high', :t)
                    RETURNING id
                """),
                {"w": TEST_WARD_ID, "t": now + timedelta(minutes=15)}
            ).fetchone()
            risk_id_2 = row2[0]

        alert_res_2 = check_and_alert(TEST_WARD_ID)
        assert alert_res_2["alert_created"] is False, "Expected repeated HIGH risk alert to be suppressed"
        print("  [PASS] Duplicate alert correctly suppressed for repeated HIGH severity\n")

        # -------------------------------------------------------------
        # Test 3: Alert Escalation (HIGH -> EXTREME)
        # -------------------------------------------------------------
        print("Test 3: Alert Escalation (HIGH -> EXTREME)")
        with engine.begin() as conn:
            row3 = conn.execute(
                text("""
                    INSERT INTO risk_scores
                        (ward_id, score_time, is_forecast, heat_index_c, wbgt_c, utci_c,
                         risk_band, risk_score_raw, vulnerability_score, final_risk_score, final_risk_band, computed_at)
                    VALUES
                        (:w, :t, false, 42.0, 32.0, 40.0, 'extreme', 85.0, 42.0, 86.89, 'extreme', :t)
                    RETURNING id
                """),
                {"w": TEST_WARD_ID, "t": now + timedelta(minutes=30)}
            ).fetchone()
            risk_id_3 = row3[0]

        alert_res_3 = check_and_alert(TEST_WARD_ID)
        assert alert_res_3["alert_created"] is True, "Expected escalation alert to be created for HIGH -> EXTREME"
        alert_id_3 = alert_res_3["alert_id"]

        with engine.connect() as conn:
            alert_row_3 = conn.execute(
                text("SELECT risk_band, message, risk_score_id FROM alerts_log WHERE id = :id"),
                {"id": alert_id_3}
            ).fetchone()

        assert alert_row_3._mapping["risk_band"] == "extreme", "Expected escalated alert risk_band 'extreme'"
        assert alert_row_3._mapping["risk_score_id"] == risk_id_3
        print(f"  [PASS] Escalation alert {alert_id_3} successfully created with risk_band='extreme'\n")

        # -------------------------------------------------------------
        # Test 4: Current Alert Must Not Use Forecast Row
        # -------------------------------------------------------------
        print("Test 4: Current Alert Query Isolation from Forecast Rows")
        with engine.begin() as conn:
            # Insert a future forecast row with extreme computed_at timestamp
            conn.execute(
                text("""
                    INSERT INTO risk_scores
                        (ward_id, score_time, is_forecast, heat_index_c, wbgt_c, utci_c,
                         risk_band, risk_score_raw, vulnerability_score, final_risk_score, final_risk_band, computed_at)
                    VALUES
                        (:w, :future_t, true, 45.0, 35.0, 42.0, 'extreme', 95.0, 42.0, 95.63, 'extreme', :computed_t)
                """),
                {
                    "w": TEST_WARD_ID,
                    "future_t": now + timedelta(days=2),
                    "computed_t": now + timedelta(hours=1) # computed after current row
                }
            )

        latest_current = get_latest_risk(TEST_WARD_ID)
        assert latest_current["id"] == risk_id_3, f"Expected current risk row ID {risk_id_3}, got {latest_current['id']}"
        assert latest_current["is_forecast"] is False if "is_forecast" in latest_current else True
        print("  [PASS] get_latest_risk() strictly returns the latest CURRENT observation, ignoring future forecasts\n")

        # -------------------------------------------------------------
        # Test 5: Forecast Warning Deduplication via risk_score_id
        # -------------------------------------------------------------
        print("Test 5: Forecast Warning Deduplication via risk_score_id")
        with engine.begin() as conn:
            fc_row = conn.execute(
                text("""
                    INSERT INTO risk_scores
                        (ward_id, score_time, is_forecast, heat_index_c, wbgt_c, utci_c,
                         risk_band, risk_score_raw, vulnerability_score, final_risk_score, final_risk_band, computed_at)
                    VALUES
                        (:w, :future_t, true, 40.0, 31.0, 38.0, 'high', 75.0, 42.0, 78.15, 'high', :t)
                    RETURNING id
                """),
                {"w": TEST_WARD_ID, "future_t": now + timedelta(days=3), "t": now}
            ).fetchone()
            forecast_risk_id = fc_row[0]

            # Mark an alert as sent for this forecast risk_score_id
            conn.execute(
                text("""
                    INSERT INTO alerts_log (ward_id, triggered_at, risk_band, channel, message, status, risk_score_id)
                    VALUES (:w, :t, 'high', 'webhook', 'Test forecast alert', 'sent', :rs_id)
                """),
                {"w": TEST_WARD_ID, "t": now, "rs_id": forecast_risk_id}
            )

        assert _warning_already_sent(forecast_risk_id) is True, "Expected _warning_already_sent to return True for sent alert"
        assert _warning_already_sent(forecast_risk_id + 99999) is False, "Expected _warning_already_sent to return False for new risk_score_id"
        print("  [PASS] _warning_already_sent() correctly identifies existing alerts by risk_score_id\n")

        print("=== ALL ALERT ENGINE TESTS PASSED SUCCESSFULLY ===")

    finally:
        cleanup_test_data()

if __name__ == "__main__":
    run_tests()
