#!/bin/bash

# Complete Cleanup Script for FrogBytes
# This script performs a complete cleanup of test data including:
# - Database records (via SQL script)
# - Storage buckets (via Node.js script)

set -e  # Exit on error

echo "============================================================================="
echo "🧹 FrogBytes Complete Cleanup Script"
echo "============================================================================="
echo ""
echo "This script will:"
echo "  1. Preview what will be deleted (database)"
echo "  2. Clean up database records (user data)"
echo "  3. Clean up storage buckets (files)"
echo ""
echo "✅ PRESERVED:"
echo "  - API keys (api_keys table)"
echo "  - Scraped keys (scraped_keys table)"
echo ""
echo "❌ DELETED:"
echo "  - All user profiles and auth users"
echo "  - All uploads, transcriptions, summaries"
echo "  - All feedback and votes"
echo "  - All collections"
echo "  - All files in storage buckets"
echo ""
echo "============================================================================="
echo ""

# Check if we have the required tools
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found"
    echo "   Install it: npm install -g supabase"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found"
    echo "   Install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found"
    echo "   Create a .env file with required environment variables"
    exit 1
fi

# Step 1: Preview cleanup
echo "📋 Step 1: Preview Database Cleanup"
echo "============================================================================="
supabase db execute < scripts/database/preview-cleanup.sql
echo ""

# Ask for confirmation
read -p "❓ Do you want to proceed with the cleanup? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""

# Step 2: Clean up database
echo "🗄️  Step 2: Clean Up Database Records"
echo "============================================================================="
supabase db execute < scripts/database/cleanup-test-data.sql
echo ""

# Step 3: Clean up storage
echo "📦 Step 3: Clean Up Storage Buckets"
echo "============================================================================="
node scripts/database/cleanup-storage.js
echo ""

# Final summary
echo "============================================================================="
echo "✅ Complete Cleanup Finished!"
echo "============================================================================="
echo ""
echo "Summary:"
echo "  ✅ Database records cleaned"
echo "  ✅ Storage buckets cleaned"
echo "  ✅ API keys preserved"
echo ""
echo "Next steps:"
echo "  1. Verify everything works by visiting your app"
echo "  2. Create new test accounts if needed"
echo "  3. Upload new test data"
echo ""
echo "============================================================================="


