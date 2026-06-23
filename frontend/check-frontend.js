const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    } else {
      console.log('BROWSER LOG:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.toString());
  });

  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 15000 });
    const content = await page.content();
    console.log('HTML SNIPPET:', content.substring(0, 500));
    
    // Check if error boundary rendered
    const hasError = await page.evaluate(() => document.body.innerHTML.includes('Something went wrong'));
    console.log('HAS ERROR BOUNDARY:', hasError);
  } catch (err) {
    console.log('GOTO ERROR:', err.message);
  } finally {
    await browser.close();
  }
})();
