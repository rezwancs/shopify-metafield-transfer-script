// Shopify Metafields Transfer Only - Google Apps Script
// ====================================================
// Step 1: Call exportMetafieldsOnly() to export metafields from source store
// Step 2: Call importMetafieldsOnly() to import metafields to destination store


const SOURCE_STORE = {
  shop: 'your-store-name.myshopify.com',
  accessToken: 'your-access-token'
};

const DESTINATION_STORE = {
  shop: 'your-store-name.myshopify.com',
  accessToken: 'your-access-token'
};

// MAIN FUNCTIONS
// ==============
function exportMetafieldsOnly() {
  try {
    console.log('Starting metafields export from source store...');
    
    const sourceProducts = getAllProducts(SOURCE_STORE);
    console.log(`Found ${sourceProducts.length} products in source store`);
    
    const metafieldsData = [];
    
    sourceProducts.forEach((product, index) => {
      console.log(`Processing product ${index + 1}/${sourceProducts.length}: ${product.title}`);
      
      const metafields = getProductMetafields(SOURCE_STORE, product.id);
      
      if (metafields.length > 0) {
        metafieldsData.push({
          title: product.title,
          handle: product.handle,
          sku: product.variants[0]?.sku || '', // Use first variant SKU as backup identifier
          sourceProductId: product.id,
          metafields: metafields
        });
        
        console.log(`Found ${metafields.length} metafields for: ${product.title}`);
      }
      
      // Rate limiting
      Utilities.sleep(300);
    });
    
    // Save to Google Sheets
    saveMetafieldsToSheets(metafieldsData);
    
    console.log(`Export completed! Found metafields for ${metafieldsData.length} products`);
    
  } catch (error) {
    console.error('Export failed:', error);
  }
}


function importMetafieldsOnly() {
  try {
    console.log('Starting metafields import to destination store...');
    
    // Get destination products for matching
    const destProducts = getAllProducts(DESTINATION_STORE);
    console.log(`Found ${destProducts.length} products in destination store`);
    
    // Create lookup map by handle (primary matching method)
    const destProductsByHandle = {};
    
    destProducts.forEach(product => {
      destProductsByHandle[product.handle] = product;
    });
    
    console.log(`✅ Created handle lookup for ${Object.keys(destProductsByHandle).length} products`);
    
    // Read exported metafields data
    const metafieldsData = readMetafieldsFromSheets();
    console.log(`Processing metafields for ${metafieldsData.length} products`);
    
    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;
    const notFoundProducts = [];
    
    metafieldsData.forEach((item, index) => {
      try {
        console.log(`Processing ${index + 1}/${metafieldsData.length}: ${item.title}`);
        
        // Since handles are the same, prioritize handle matching
        let destProduct = destProductsByHandle[item.handle];
        
        if (!destProduct) {
          console.log(`⚠️  Product handle not found in destination: ${item.handle} (${item.title})`);
          notFoundProducts.push(`${item.title} (${item.handle})`);
          notFoundCount++;
          return;
        }
        
        console.log(`✅ Found matching product: ${destProduct.title} (Handle: ${destProduct.handle})`);
        
        // Create metafields for the matched product
        let metafieldSuccess = 0;
        let metafieldErrors = 0;
        
        item.metafields.forEach(metafield => {
          try {
            createSingleMetafield(DESTINATION_STORE, destProduct.id, metafield);
            metafieldSuccess++;
            
            // Rate limiting between metafield creations
            Utilities.sleep(200);
            
          } catch (error) {
            // Handle specific metafield errors
            const errorMsg = error.toString();
            if (errorMsg.includes('already exists')) {
              console.log(`   ⚠️  Metafield already exists: ${metafield.namespace}.${metafield.key}`);
            } else {
              console.error(`   ❌ Error creating metafield ${metafield.namespace}.${metafield.key}:`, error);
              metafieldErrors++;
            }
          }
        });
        
        console.log(`   📝 Created ${metafieldSuccess} metafields (${metafieldErrors} errors)`);
        successCount++;
        
        // Rate limiting between products
        Utilities.sleep(500);
        
      } catch (error) {
        console.error(`Error processing ${item.title}:`, error);
        errorCount++;
      }
    });
    
    console.log(`\nImport Summary:`);
    console.log(`✅ Successfully processed: ${successCount} products`);
    console.log(`❌ Products not found: ${notFoundCount}`);
    console.log(`⚠️  Processing errors: ${errorCount}`);
    
    if (notFoundProducts.length > 0) {
      console.log(`\n❌ Products not found in destination store:`);
      notFoundProducts.forEach(product => console.log(`   - ${product}`));
      console.log(`\n💡 Tip: Check if these products exist in destination store with the same handles`);
    } else {
      console.log(`\n🎉 All products were successfully matched by handle!`);
    }
    
  } catch (error) {
    console.error('Import failed:', error);
  }
}


// SHOPIFY API FUNCTIONS
// ====================
function getAllProducts(store) {
  const products = [];
  let pageInfo = null;
  
  do {
    let url = `https://${store.shop}/admin/api/2023-10/products.json?limit=250&fields=id,title,handle,variants`;
    if (pageInfo) {
      url += `&page_info=${pageInfo}`;
    }
    
    const response = makeShopifyRequest(store, url);
    const data = JSON.parse(response.getContentText());
    
    products.push(...data.products);
    
    // Check for pagination
    const linkHeader = response.getHeaders()['Link'];
    pageInfo = extractPageInfo(linkHeader, 'next');
    
  } while (pageInfo);
  
  return products;
}

function getProductMetafields(store, productId) {
  const url = `https://${store.shop}/admin/api/2023-10/products/${productId}/metafields.json`;
  
  try {
    const response = makeShopifyRequest(store, url);
    const data = JSON.parse(response.getContentText());
    return data.metafields || [];
  } catch (error) {
    console.error(`Error getting metafields for product ${productId}:`, error);
    return [];
  }
}

function createSingleMetafield(store, productId, metafield) {
  const metafieldData = {
    metafield: {
      namespace: metafield.namespace,
      key: metafield.key,
      value: metafield.value,
      type: metafield.type
    }
  };
  
  const url = `https://${store.shop}/admin/api/2023-10/products/${productId}/metafields.json`;
  
  const response = makeShopifyRequest(store, url, 'POST', JSON.stringify(metafieldData));
  
  if (response.getResponseCode() === 201) {
    console.log(`✅ Created metafield: ${metafield.namespace}.${metafield.key}`);
  } else {
    throw new Error(`Failed to create metafield: ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

// UTILITY FUNCTIONS
// ================
function makeShopifyRequest(store, url, method = 'GET', payload = null) {
  const options = {
    method: method,
    headers: {
      'X-Shopify-Access-Token': store.accessToken,
      'Content-Type': 'application/json'
    }
  };
  
  if (payload) {
    options.payload = payload;
  }
  
  const response = UrlFetchApp.fetch(url, options);
  
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`API request failed: ${response.getResponseCode()} - ${response.getContentText()}`);
  }
  
  return response;
}

function extractPageInfo(linkHeader, direction) {
  if (!linkHeader) return null;
  
  const regex = direction === 'next' ? 
    /<([^>]+)>; rel="next"/ : 
    /<([^>]+)>; rel="previous"/;
  
  const match = linkHeader.match(regex);
  if (match) {
    const url = match[1];
    const pageInfoMatch = url.match(/page_info=([^&]+)/);
    return pageInfoMatch ? pageInfoMatch[1] : null;
  }
  
  return null;
}

// GOOGLE SHEETS FUNCTIONS
// =======================
function saveMetafieldsToSheets(metafieldsData) {
  const spreadsheet = SpreadsheetApp.create('Shopify Metafields Export');
  const sheet = spreadsheet.getActiveSheet();
  
  // Headers
  const headers = ['Title', 'Handle', 'SKU', 'Source Product ID', 'Metafields Count', 'Metafields JSON'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Data rows
  const rows = metafieldsData.map(item => [
    item.title,
    item.handle,
    item.sku,
    item.sourceProductId,
    item.metafields.length,
    JSON.stringify(item.metafields)
  ]);
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  console.log(`Metafields data saved to Google Sheets: ${spreadsheet.getUrl()}`);
  
  // Save spreadsheet ID for import
  PropertiesService.getScriptProperties().setProperty('METAFIELDS_SPREADSHEET_ID', spreadsheet.getId());
}

function readMetafieldsFromSheets() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('METAFIELDS_SPREADSHEET_ID');
  
  if (!spreadsheetId) {
    throw new Error('No metafields spreadsheet found. Run exportMetafieldsOnly() first.');
  }
  
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getActiveSheet();
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    const metafields = JSON.parse(row[5] || '[]');
    
    return {
      title: row[0],
      handle: row[1],
      sku: row[2],
      sourceProductId: row[3],
      metafields: metafields
    };
  });
}
