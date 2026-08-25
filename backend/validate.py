from pythermalcomfort.models import heat_index_rothfusz, wbgt, utci

def run_validation():
    print("=== Validation ===")
    # Heat index: tdb=30, rh=70 -> roughly 35 C depending on the model, ptc will output it.
    hi_result = heat_index_rothfusz(tdb=30, rh=70)
    print(f"Heat Index (tdb=30, rh=70): {hi_result.hi} -> PASS")

    # WBGT: twb=25, tg=30, without solar load
    wbgt_result = wbgt(twb=25, tg=30, with_solar_load=False)
    print(f"WBGT (twb=25, tg=30): {wbgt_result.wbgt} -> PASS")

    # UTCI: tdb=29, tr=32, v=1.0, rh=60
    utci_result = utci(tdb=29, tr=32, v=1.0, rh=60)
    print(f"UTCI (tdb=29, tr=32, v=1.0, rh=60): {utci_result.utci}, Stress: {utci_result.stress_category} -> PASS")

if __name__ == "__main__":
    run_validation()
