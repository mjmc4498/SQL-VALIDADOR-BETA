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

        # Fill out the form with grouped tables
        await page.fill('#project1', 'prd-project-123')
        await page.fill('#dataset1', 'sales_data')
        await page.fill('#table1', 'sales_2024_q1, sales_2024_q2')
        await page.fill('#project2', 'stg-project-456')
        await page.fill('#dataset2', 'sales_data_stg')
        await page.fill('#table2', 'sales_stg_2024_q1, sales_stg_2024_q2')
        await page.fill('#key-columns', 'sale_id, customer_id')
        await page.fill('#filters', "region = 'EAST'")

        # Click the generate button
        await page.click('button[type="submit"]')

        # Wait for the textarea to be populated
        await page.wait_for_selector('#output:not(:empty)')

        # Take a screenshot of the full page
        await page.screenshot(path='jules-scratch/verification/table_groups_output.png', full_page=True)

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
