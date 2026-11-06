// Illustration-only inspection. Animation previews use scripts/preview-scene.mjs.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage();await page.setViewport({width:1280,height:720,deviceScaleFactor:1});
 for(const name of ['detailed-family','original-bedtime']){
  const art=fs.readFileSync(new URL(`./${name}.key-pose.svg`,import.meta.url),'utf8');
  await page.setContent(`<html><body style="margin:0">${art}</body></html>`);
  await page.screenshot({path:new URL(`./${name}.key-pose.png`,import.meta.url).pathname});
 }
}finally{await browser.close();}
