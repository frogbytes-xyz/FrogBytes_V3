#!/bin/bash

# Quick Preview Script
# Just shows what will be deleted without making changes

echo "============================================================================="
echo "📋 Preview Database Cleanup"
echo "============================================================================="
echo ""

supabase db execute < scripts/database/preview-cleanup.sql

echo ""
echo "To proceed with cleanup, run:"
echo "  ./scripts/database/cleanup-all.sh"
echo ""


