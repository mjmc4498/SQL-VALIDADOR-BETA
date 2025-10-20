import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Navigate to the local HTML file
        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # Fill out the form with grouped tables to test the new schema logic
        await page.fill('#project1', 'prd-project-data')
        await page.fill('#dataset1', 'core_data')
        await page.fill('#table1', 'customers_2023, customers_2024')
        await page.fill('#project2', 'stg-project-data')
        await page.fill('#dataset2', 'core_data_stg')
        await page.fill('#table2', 'customers_stg_2023, customers_stg_2024')
        await page.fill('#key-columns', 'customer_id')

        # Click the generate button
        await page.click('button[type="submit"]')

        # Wait for the textarea to be populated
        await page.wait_for_selector('#output:not(:empty)')

        # Take a screenshot of the full page
        await page.screenshot(path='jules-scratch/verification/enhanced_schema_output.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
