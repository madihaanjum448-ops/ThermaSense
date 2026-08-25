from pythermalcomfort.models import heat_index_rothfusz, wbgt, utci


def check(name, actual, expected):
    passed = abs(actual - expected) < 0.1
    status = "PASS" if passed else "FAIL"

    print(
        f"{name}: actual={actual}, "
        f"expected={expected} -> {status}"
    )

    return passed


def run_validation():
    print("=== ThermaSense Thermal Formula Validation ===\n")

    # 1. Heat Index
    hi_result = heat_index_rothfusz(tdb=29, rh=50)
    hi_pass = check(
        "Heat Index",
        hi_result.hi,
        29.7
    )

    # 2. WBGT
    wbgt_result = wbgt(twb=25, tg=32)
    wbgt_pass = check(
        "WBGT",
        wbgt_result.wbgt,
        27.1
    )

    # 3. UTCI
    utci_result = utci(
        tdb=25,
        tr=25,
        v=1.0,
        rh=50
    )
    utci_pass = check(
        "UTCI",
        utci_result.utci,
        24.6
    )

    print("\n=== Final Result ===")

    if hi_pass and wbgt_pass and utci_pass:
        print("ALL VALIDATIONS PASSED")
    else:
        print("VALIDATION FAILED")


if __name__ == "__main__":
    run_validation()
