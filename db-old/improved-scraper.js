const { chromium } = require('playwright');
const { log } = require('./debug');

/**
 * Scrapes a single ECHR application page
 * Returns null if not found, otherwise returns complete data
 */
async function scrapeECHRApplication(applicationNumber, applicationYear) {
	const url = `https://app.echr.coe.int/SOP/en-GB/application?number=${applicationNumber}%2F${applicationYear}`;
	
	log(`🔍 Checking: ${applicationNumber}/${applicationYear}`, true);

	const browser = await chromium.launch({ 
		headless: true,
		timeout: 30000 
	});
	
	try {
		const context = await browser.newContext();
		const page = await context.newPage();

		// Navigate to the URL
		await page.goto(url, { 
			waitUntil: 'domcontentloaded',
			timeout: 15000 
		});

		// Check if ResultPanel exists (page loaded successfully)
		const resultPanelExists = await page.$('#ResultPanel');
		if (!resultPanelExists) {
			log(`   ❌ Not found`);
			return null;
		}

		// Wait for the result panel
		await page.waitForSelector('#ResultPanel', { timeout: 5000 });

		// Extract ALL data from the page
		const data = await page.evaluate(() => {
			const getText = (selector) => {
				const element = document.querySelector(selector);
				return element ? element.textContent.trim() : null;
			};

			// 1. Application Number
			const applicationNumber = getText('#ApplicationNumber p');

			// 2. Application Title
			const applicationTitle = getText('#ApplicationTitle p');

			// 3. Date of Introduction
			const dateIntroduction = getText('#DateIntroduction p');

			// 4. Representative
			const representant = getText('#Representant p');

			// 5. List of Major Events (this is the MAIN source of truth)
			const majorEventsList = [];
			const rows = document.querySelectorAll('#MajorEventsList tbody tr');
			
			rows.forEach(row => {
				const description = row.querySelector('td:nth-child(1)')?.textContent.trim();
				const eventDate = row.querySelector('td:nth-child(2)')?.textContent.trim();
				
				if (description && eventDate) {
					majorEventsList.push({ 
						description: description,
						eventDate: eventDate 
					});
				}
			});

			// 6. Last Major Event (get from the LAST item in the list)
			let lastMajorEvent = null;
			let lastMajorEventDate = null;

			if (majorEventsList.length > 0) {
				const lastEvent = majorEventsList[majorEventsList.length - 1];
				lastMajorEvent = lastEvent.description;
				lastMajorEventDate = lastEvent.eventDate;
			}

			return {
				applicationNumber,
				applicationTitle,
				dateIntroduction,
				representant,
				lastMajorEvent,
				lastMajorEventDate,
				majorEventsList  // Full list with ALL events
			};
		});

		// Validate essential data
		if (!data.applicationNumber || !data.applicationTitle) {
			log(`   ⚠️  Page found but missing essential data`, true);
			return null;
		}

		// Pretty print the results
		log(`   ✅ Found: ${data.applicationTitle}`);
		log(`   👤 Representative: ${data.representant || 'N/A'}`);
		log(`   📅 Introduced: ${data.dateIntroduction || 'N/A'}`);
		log(`   📋 Events: ${data.majorEventsList.length}`);
		log(`   🔔 Last Event: ${data.lastMajorEvent || 'N/A'}`);
		log(`   📆 Last Event Date: ${data.lastMajorEventDate || 'N/A'}`);
		
		return data;

	} catch (error) {
		log(`   ❌ Error: ${error.message}`, true);
		return null;
	} finally {
		await browser.close();
	}
}

module.exports = { scrapeECHRApplication };