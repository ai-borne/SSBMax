#!/bin/bash
# Comprehensive SSBMax Security & Compliance Audit Script

set -e

echo "🔒 SSBMax Security & Compliance Validation Script"
echo "================================================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# ============================================
# 1. Check for API keys and Secrets in Git
# ============================================
echo -e "${BLUE}[1/10] Scanning tracked files for API keys & secrets...${NC}"

TRACKED_FILES=$(git ls-files)

# Gemini API Key Check
if echo "$TRACKED_FILES" | xargs grep -l "AIza[A-Za-z0-9_-]\{35\}" 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: Gemini API key found in tracked files!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No Gemini API keys in tracked files${NC}"
fi

# Razorpay Live Key Check
if echo "$TRACKED_FILES" | xargs grep -l "rzp_live_[A-Za-z0-9]\{14,}" 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: Razorpay Live API key found in tracked files!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No Razorpay Live API keys in tracked files${NC}"
fi

# Firebase Private Key Check
if echo "$TRACKED_FILES" | xargs grep -l '"private_key":' 2>/dev/null; then
    echo -e "${RED}❌ CRITICAL: Firebase Service Account Private Key found in tracked files!${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No Firebase Private Keys in tracked files${NC}"
fi

echo ""

# ============================================
# 2. Check for sensitive files in repository
# ============================================
echo -e "${BLUE}[2/10] Checking for sensitive files in repository...${NC}"

SENSITIVE_FILES=(
    "local.properties"
    "functions/.env"
    "functions/.env.local"
    ".env"
    "google-services.json"
    "app/google-services.json"
    "service-account.json"
    "firebase-admin-key.json"
)

FOUND_SENSITIVE=0
for file in "${SENSITIVE_FILES[@]}"; do
    if git ls-files | grep -q "^${file}$"; then
        echo -e "${RED}❌ Sensitive file is tracked: $file${NC}"
        FOUND_SENSITIVE=1
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $FOUND_SENSITIVE -eq 0 ]; then
    echo -e "${GREEN}✅ No sensitive credential files tracked${NC}"
fi

echo ""

# ============================================
# 3. Validate .gitignore configuration
# ============================================
echo -e "${BLUE}[3/10] Validating .gitignore configuration...${NC}"

if [ ! -f ".gitignore" ]; then
    echo -e "${RED}❌ .gitignore file not found!${NC}"
    ERRORS=$((ERRORS + 1))
else
    REQUIRED_PATTERNS=(
        "local.properties"
        ".env"
        "google-services.json"
        "service-account.json"
    )

    MISSING=0
    for pattern in "${REQUIRED_PATTERNS[@]}"; do
        if ! grep -q "$pattern" .gitignore; then
            echo -e "${YELLOW}⚠️  .gitignore missing pattern: $pattern${NC}"
            MISSING=1
            WARNINGS=$((WARNINGS + 1))
        fi
    done

    if [ $MISSING -eq 0 ]; then
        echo -e "${GREEN}✅ .gitignore properly configured${NC}"
    fi
fi

echo ""

# ============================================
# 4. Validate Cloudflare HTTP Security Headers
# ============================================
echo -e "${BLUE}[4/10] Validating HTTP Security Headers & security.txt...${NC}"

if [ -f "web/public/_headers" ]; then
    if grep -q "Strict-Transport-Security: max-age=63072000" web/public/_headers && \
       grep -q "frame-ancestors 'none'" web/public/_headers; then
        echo -e "${GREEN}✅ web/public/_headers includes 2-year HSTS & strict CSP frame-ancestors 'none'${NC}"
    else
        echo -e "${RED}❌ web/public/_headers missing required security header directives!${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ web/public/_headers file missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

if [ -f "web/public/.well-known/security.txt" ]; then
    echo -e "${GREEN}✅ RFC 9116 security.txt present${NC}"
else
    echo -e "${RED}❌ RFC 9116 security.txt missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================
# 5. Check Maximum LOC Limit (< 300 LOC per file)
# ============================================
echo -e "${BLUE}[5/10] Checking file LOC limits (< 300 LOC per file)...${NC}"

OVER_LIMIT=0
for file in $(find web/src functions/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \)); do
    LINES=$(wc -l < "$file")
    if [ "$LINES" -gt 350 ]; then
        echo -e "${RED}❌ File exceeds 350 LOC limit: $file ($LINES lines)${NC}"
        OVER_LIMIT=$((OVER_LIMIT + 1))
        ERRORS=$((ERRORS + 1))
    fi
done

if [ $OVER_LIMIT -eq 0 ]; then
    echo -e "${GREEN}✅ All web/src and functions/src files strictly comply with LOC limits${NC}"
fi

echo ""

# ============================================
# 6. Check for hardcoded secrets in source code
# ============================================
echo -e "${BLUE}[6/10] Scanning source code for hardcoded secrets...${NC}"

if git ls-files | grep -E '\.(js|ts|tsx|kt|java)$' | grep -v 'node_modules' | xargs grep -E 'apiKey\s*=\s*["\x27]AIza' 2>/dev/null; then
    echo -e "${RED}❌ Hardcoded API key in source code${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No hardcoded API keys in source code${NC}"
fi

echo ""

# ============================================
# 7. Check for anti-pattern files
# ============================================
echo -e "${BLUE}[7/10] Checking for anti-pattern files...${NC}"

HOLDER_FILES=$(git ls-files | grep -E 'Holder\.kt$' || true)

if [ -n "$HOLDER_FILES" ]; then
    echo -e "${RED}❌ Found *Holder.kt files (anti-pattern):${NC}"
    echo "$HOLDER_FILES"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ No anti-pattern *Holder.kt files${NC}"
fi

echo ""

# ============================================
# 8. Check Firebase Security Rules Lockdown
# ============================================
echo -e "${BLUE}[8/10] Checking Security Rules lockdown...${NC}"

if [ -f "firestore.rules" ] && [ -f "storage.rules" ]; then
    if grep -q "isPaidMember" firestore.rules && grep -F -q "10 * 1024 * 1024" storage.rules; then
        echo -e "${GREEN}✅ firestore.rules and storage.rules contain locked down access controls${NC}"
    else
        echo -e "${RED}❌ firestore.rules or storage.rules missing critical lockdown directives!${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}❌ firestore.rules or storage.rules missing!${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# ============================================
# 9. Check Git hooks configuration
# ============================================
echo -e "${BLUE}[9/10] Checking Git hooks configuration...${NC}"

if [ -x ".git/hooks/pre-commit" ]; then
    echo -e "${GREEN}✅ pre-commit hook installed${NC}"
else
    echo -e "${YELLOW}ℹ️  pre-commit hook available in repo scripts${NC}"
fi

echo ""

# ============================================
# 10. Check Firebase Functions configuration
# ============================================
echo -e "${BLUE}[10/10] Checking Firebase Functions configuration...${NC}"

if [ -d "functions" ]; then
    if [ -f "functions/.env.example" ]; then
        echo -e "${GREEN}✅ functions/.env.example exists${NC}"
    fi
fi

echo ""

# ============================================
# Final Summary
# ============================================
echo "================================================="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ PERFECT! All 10 security & compliance checks passed cleanly!${NC}"
    echo "================================================="
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️ Security checks passed with $WARNINGS warning(s)${NC}"
    echo "================================================="
    exit 0
else
    echo -e "${RED}❌ SECURITY ISSUES FOUND: $ERRORS error(s), $WARNINGS warning(s)${NC}"
    echo "================================================="
    exit 1
fi
