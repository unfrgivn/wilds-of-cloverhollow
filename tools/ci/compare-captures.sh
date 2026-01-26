#!/usr/bin/env bash
# Compare current captures against golden captures
set -euo pipefail

GOLDEN_DIR="${GOLDEN_DIR:-captures/golden}"
CURRENT_DIR="${CURRENT_DIR:-captures/current}"
DIFF_DIR="${DIFF_DIR:-captures/diff-report}"
THRESHOLD="${THRESHOLD:-0.01}"  # 1% pixel difference threshold

mkdir -p "$DIFF_DIR"

# Generate HTML report header
cat > "$DIFF_DIR/index.html" << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Report</title>
    <style>
        body { font-family: sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        .new { color: blue; }
        .comparison { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
        .comparison img { max-width: 300px; border: 1px solid #ccc; }
        .diff-image { border-color: red !important; }
        h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
    </style>
</head>
<body>
<h1>Visual Regression Report</h1>
<p>Generated: DATE_PLACEHOLDER</p>
<div id="summary"></div>
<div id="results">
EOF

PASS=0
FAIL=0
NEW=0

# Check if golden directory exists
if [ ! -d "$GOLDEN_DIR" ]; then
    echo "[compare] No golden captures found at $GOLDEN_DIR"
    echo "[compare] Run with update_golden=true to create baseline"
    echo "<h2 class=\"new\">No golden captures found</h2>" >> "$DIFF_DIR/index.html"
    echo "<p>Run workflow with update_golden=true to create baseline.</p>" >> "$DIFF_DIR/index.html"
    
    # Close HTML
    echo "</div></body></html>" >> "$DIFF_DIR/index.html"
    exit 0
fi

# Compare each scenario
for scenario_dir in "$CURRENT_DIR"/*; do
    [ -d "$scenario_dir" ] || continue
    scenario=$(basename "$scenario_dir")
    
    echo "[compare] Checking scenario: $scenario"
    echo "<h2>$scenario</h2>" >> "$DIFF_DIR/index.html"
    
    golden_scenario_dir="$GOLDEN_DIR/$scenario"
    
    if [ ! -d "$golden_scenario_dir" ]; then
        echo "[compare] NEW: $scenario (no golden baseline)"
        echo "<p class=\"new\">NEW - No golden baseline</p>" >> "$DIFF_DIR/index.html"
        NEW=$((NEW + 1))
        continue
    fi
    
    # Compare each capture in the scenario
    for capture in "$scenario_dir"/*.png; do
        [ -f "$capture" ] || continue
        capture_name=$(basename "$capture")
        golden_capture="$golden_scenario_dir/$capture_name"
        
        if [ ! -f "$golden_capture" ]; then
            echo "[compare] NEW: $scenario/$capture_name"
            echo "<p class=\"new\">NEW: $capture_name</p>" >> "$DIFF_DIR/index.html"
            NEW=$((NEW + 1))
            continue
        fi
        
        # Create diff directory for this scenario
        mkdir -p "$DIFF_DIR/$scenario"
        diff_output="$DIFF_DIR/$scenario/${capture_name%.png}_diff.png"
        
        # Compare images using ImageMagick
        # Returns non-zero if images differ beyond threshold
        diff_result=$(compare -metric AE -fuzz "${THRESHOLD}%" "$golden_capture" "$capture" "$diff_output" 2>&1 || true)
        
        if [ "$diff_result" = "0" ]; then
            echo "[compare] PASS: $scenario/$capture_name"
            echo "<p class=\"pass\">✓ $capture_name</p>" >> "$DIFF_DIR/index.html"
            rm -f "$diff_output"  # Remove diff for identical images
            PASS=$((PASS + 1))
        else
            echo "[compare] FAIL: $scenario/$capture_name (${diff_result} pixels differ)"
            FAIL=$((FAIL + 1))
            
            # Add comparison to report
            cat >> "$DIFF_DIR/index.html" << EOF
<p class="fail">✗ $capture_name - ${diff_result} pixels differ</p>
<div class="comparison">
    <div>
        <p>Golden</p>
        <img src="../$golden_capture" alt="golden">
    </div>
    <div>
        <p>Current</p>
        <img src="../$capture" alt="current">
    </div>
    <div>
        <p>Diff</p>
        <img src="$scenario/${capture_name%.png}_diff.png" alt="diff" class="diff-image">
    </div>
</div>
EOF
        fi
    done
done

# Update summary
TOTAL=$((PASS + FAIL + NEW))
sed -i "s/DATE_PLACEHOLDER/$(date)/" "$DIFF_DIR/index.html" 2>/dev/null || \
    sed "s/DATE_PLACEHOLDER/$(date)/" "$DIFF_DIR/index.html" > "$DIFF_DIR/index.html.tmp" && mv "$DIFF_DIR/index.html.tmp" "$DIFF_DIR/index.html"

cat >> "$DIFF_DIR/index.html" << EOF
</div>
<script>
document.getElementById('summary').innerHTML = 
    '<p><strong>Summary:</strong> $PASS passed, $FAIL failed, $NEW new (total: $TOTAL)</p>';
</script>
</body>
</html>
EOF

echo "[compare] Summary: $PASS passed, $FAIL failed, $NEW new"

if [ $FAIL -gt 0 ]; then
    echo "[compare] Visual regression detected!"
    exit 1
fi

echo "[compare] All checks passed"
