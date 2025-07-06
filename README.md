# Shopify Metafield Transfer Script

This script allows you to export product metafields from one Shopify store and import them into another. It is designed to help merchants and developers migrate or duplicate product metafields between stores efficiently.

## Features
- Export all product metafields from a source Shopify store
- Save exported metafields to a Google Sheet
- Import metafields into a destination Shopify store, matching products by handle
- Handles Shopify API pagination and rate limiting
- Logs progress and errors for easy troubleshooting

## Prerequisites
- **Google Apps Script**: This script is written for Google Apps Script and is intended to be run in the Google Apps Script environment (e.g., via Google Sheets or script.google.com).
- **Shopify Admin API Access**: You need Admin API access tokens for both the source and destination stores with permissions to read and write products and metafields.

## Setup
1. **Copy the Script**
   - Copy the contents of `index.js` into a new Google Apps Script project.

2. **Configure Store Credentials**
   - In the script, update the `SOURCE_STORE` and `DESTINATION_STORE` objects with your Shopify store domains and Admin API access tokens:
     ```js
     const SOURCE_STORE = {
       shop: 'source-store.myshopify.com',
       accessToken: 'source-access-token'
     };
     const DESTINATION_STORE = {
       shop: 'destination-store.myshopify.com',
       accessToken: 'destination-access-token'
     };
     ```

3. **Enable Required Google Services**
   - In the Apps Script editor, go to **Services** and add:
     - **Google Sheets API**
     - **Properties Service** (built-in)
     - **UrlFetchApp** (built-in)

## Usage
### 1. Export Metafields from Source Store
- Run the `exportMetafieldsOnly()` function.
- The script will:
  - Fetch all products from the source store
  - Retrieve all metafields for each product
  - Save the data to a new Google Sheet (the URL will be logged)
  - Store the spreadsheet ID for later import

### 2. Import Metafields to Destination Store
- Run the `importMetafieldsOnly()` function.
- The script will:
  - Fetch all products from the destination store
  - Read the exported metafields from the Google Sheet
  - Match products by handle
  - Create metafields for each matched product
  - Log a summary of the import process

## Notes
- **Product Matching**: Products are matched by their `handle`. Ensure that product handles are consistent between source and destination stores.
- **Rate Limiting**: The script includes delays to respect Shopify API rate limits. Adjust `Utilities.sleep()` durations if needed.
- **Error Handling**: Errors and warnings are logged to the console. Review logs for any issues with specific products or metafields.

## Troubleshooting
- If you see "No metafields spreadsheet found", ensure you have run the export step first.
- If products are not found in the destination store, check that their handles match those in the source store.
- For API errors, verify your access tokens and API permissions.

## License
MIT License

---

**Author:** [Your Name]

Feel free to contribute or open issues for improvements! 