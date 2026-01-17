import argparse
import os
import sys


def _parse_args() -> argparse.Namespace:
    if "--" not in sys.argv:
        raise SystemExit("Missing -- separator for script arguments")
    args = sys.argv[sys.argv.index("--") + 1 :]
    parser = argparse.ArgumentParser(description="Export character spritesheets")
    parser.add_argument("--character", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args)


def main() -> None:
    args = _parse_args()
    out_dir = os.path.join(os.path.abspath(args.out), args.character)
    os.makedirs(out_dir, exist_ok=True)
    print(
        "[ExportCharacter] Stub exporter. Implement character rig/animation renders here."
    )


if __name__ == "__main__":
    main()
