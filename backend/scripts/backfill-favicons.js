/**
 * Backfill Favicon URLs for Existing Bookmarks
 *
 * This script updates all existing bookmarks in Qdrant that have null favicon_url
 * by generating favicon URLs using Google's favicon service.
 */

import { qdrantClient, COLLECTION_NAME } from '../src/config/qdrant.js';

/**
 * Generate favicon URL from page URL using Google's favicon service
 */
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (error) {
    console.warn(`Failed to generate favicon URL for ${url}:`, error.message);
    return null;
  }
}

/**
 * Backfill favicons for all bookmarks
 */
async function backfillFavicons() {
  try {
    console.log('🔄 Starting favicon backfill...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let offset = 0;
    const limit = 100;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
      // Scroll through all points in batches
      const scrollResult = await qdrantClient.scroll(COLLECTION_NAME, {
        limit: limit,
        offset: offset,
        with_payload: true,
        with_vector: false
      });

      const points = scrollResult.points;

      if (points.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing batch: ${offset}-${offset + points.length}...`);

      // Process each point
      for (const point of points) {
        totalProcessed++;

        // Check if favicon_url is null or missing
        if (!point.payload.favicon_url && point.payload.url) {
          const faviconUrl = getFaviconUrl(point.payload.url);

          if (faviconUrl) {
            // Update the point with favicon_url
            await qdrantClient.setPayload(COLLECTION_NAME, {
              points: [point.id],
              payload: {
                favicon_url: faviconUrl
              }
            });

            totalUpdated++;
            console.log(`  ✅ Updated: ${point.payload.title || point.payload.url}`);
          }
        }
      }

      offset += points.length;

      // If we got fewer points than the limit, we've reached the end
      if (points.length < limit) {
        hasMore = false;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Favicon backfill complete!');
    console.log(`📊 Total points processed: ${totalProcessed}`);
    console.log(`🔄 Points updated: ${totalUpdated}`);
    console.log(`✨ Points already had favicons: ${totalProcessed - totalUpdated}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error during favicon backfill:', error);
    throw error;
  }
}

// Run the backfill
backfillFavicons()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
