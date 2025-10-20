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

        # Fill out the form with example data
        await page.fill('#project1', 'prd-project-123')
        await page.fill('#dataset1', 'customer_data')
        await page.fill('#table1', 'orders')
        await page.fill('#project2', 'stg-project-456')
        await page.fill('#dataset2', 'customer_data_stg')
        await page.fill('#table2', 'orders_stg')
        await page.fill('#key-columns', 'order_id, customer_id')
        await page.fill('#filters', "date > '2024-01-01'")

        # Click the generate button
        await page.click('button[type="submit"]')

        # Wait for the textarea to be populated
        await page.wait_for_selector('#output:not(:empty)')

        # Take a screenshot of the full page
        await page.screenshot(path='jules-scratch/verification/summary_query_output.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
