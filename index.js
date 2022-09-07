import puppeteer from 'puppeteer-core';
import * as dotenv from 'dotenv'
import urllib from 'urllib';
import FormStream from 'formstream'
dotenv.config();

const sendMessageToDiscord = (content) => {
    const api = process.env.DISCORD_HOOK;
    const form = new FormStream();

    if (Array.isArray(content)) {
        if (content.length === 0) {
            return urllib.request(api, {
                method: 'POST',
                data: {
                    content: '没有新的内容'
                },
                enableProxy: Boolean(process.env.LOCAL_PROXY),
                proxy: process.env.LOCAL_PROXY,
            });
        }
        content.reverse();
        content.forEach((item, index) => {
            if (index <= 9) {
                form.buffer(`files[${index + 1}]`, item, `screenshot${index + 1}.jpg`, 'images/jpeg');
            }
        });
    } else {
        form.buffer('files', content, 'screenshot.jpg', 'images/jpeg');
    }
    form.field('content', 'hi')

    return urllib.request(api, {
        method: 'POST',
        headers: form.headers(),
        stream: form,
        enableProxy: Boolean(process.env.LOCAL_PROXY),
        proxy: process.env.LOCAL_PROXY,
    });
};

(async () => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        executablePath: process.env.PUPPETEER_EXEC_PATH, 
        headless: true,
        defaultViewport: {
            width: 375,
            height: 375 * 2,
        }
    });
    const page = await browser.newPage();
    
    await page.setCookie(...JSON.parse(process.env.COOKIE_TOKEN));
    await page.goto(process.env.TARGET_WEIBO, {
        waitUntil: 'networkidle2',
    });

    await new Promise(r => setTimeout(r, 5000));
   
    const elements = await page.$$('.wb-item');
    // 过滤1小时内的微博
    const effWeiboItems = await Promise.all(elements.map(async (ele, index) => {
        const eleTimeEl = await ele.$('.time');
        const eleTimeStr = await page.evaluate(iel => iel.textContent, eleTimeEl);
        if (/分钟前/.test(eleTimeStr)) {
            return ele;
        }

        // if (/1小时前/.test(eleTimeStr)) {
        //     return ele;
        // }

        return false;
    }));
    const images = await Promise.all(effWeiboItems.filter(Boolean).map((ele, index) => {
        return ele.screenshot({ type: 'jpeg', encoding: 'binary' });
    }).filter(Boolean));

    await sendMessageToDiscord(images);
    // await page.screenshot({ path: 'sb.png', fullPage: true });
    await browser.close();
})();