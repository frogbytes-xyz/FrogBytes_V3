/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js when the server starts.
 * We use it to initialize background services.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only in development mode
    if (process.env.NODE_ENV === 'development') {
      // Dynamically import to avoid loading on client
      const { startBackgroundServices, startStatusMonitor } = await import('@/lib/api-keys/startup');

      console.log('\n=============================================');
      console.log('🚀 Initializing Background Services');
      console.log('=============================================\n');

      try {
        await startBackgroundServices();

        console.log('\n[SUCCESS] All background services initialized');

        // Start periodic status monitor (every 10 minutes)
        startStatusMonitor(10);

        console.log('\n📊 Monitoring:');
        console.log('   - Real-time status: /api/admin/api-keys/status');
        console.log('   - Admin dashboard: /admin/api-keys-v2');
        console.log('   - Scraped keys: /api/admin/api-keys/scraped\n');
      } catch (error) {
        console.error('\n❌ [ERROR] Failed to initialize background services:', error);
      }
    }
  }
}
