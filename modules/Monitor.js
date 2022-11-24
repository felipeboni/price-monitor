'use strict'
var path = require('path')
var PriceMonitoring = require('../index')
const { Telegraf } = require('telegraf') // Telegram integration
const turl = require('turl') // Generate TinyURL links to use on messages

const bot = new Telegraf('5821040324:AAF450drhlUv8gSpyU0rChA270WavtFQkCU')

var pm = new PriceMonitoring({
  parsersDir: path.join(__dirname, 'parsers/'), // add parsers
  interval: 5000
})

const getHiddenLink = (url, parse_mode = "markdown") => {
  const emptyChar = "‎"; // copied and pasted the char from https://emptycharacter.com/

  switch (parse_mode) {
    case "markdown":
      return `[${emptyChar}](${url})`;
    case "HTML":
      return `<a href="${url}">${emptyChar}</a>`;
    default:
      throw new Error("invalid parse_mode");
  }
}

/* get general info */
console.log('N. of Parsers loaded', pm.getParsersCount())

/* parse Products from CSV */
var fileInput = path.join(__dirname, 'products.csv')

/* First instatiate the listeners */
pm.on('error', console.log)

pm.on('submit', function (product) {
  console.log(product.name, 'submitted')
})

pm.on('skip', function (product) {
  console.log('No parser found for', product)
})

pm.on('priceFetched', function (product, currentPrice) {
  console.log(product.name, 'got', currentPrice)

  // bot.telegram.sendMessage('-1001546866585', `${product.name} got ${currentPrice}`);
})

pm.on('priceAlert', function (product, newPrice, imageUrl) {
  console.log('Alert!', product.name, 'got', newPrice)
  
  turl.shorten(product.link).then(res => {
    bot.telegram.sendMessage('-1001546866585',
    `📢 PROMOÇÃO - ${product.name}

💵 De R$ ${product.price}
🔥 por R$ ${newPrice}
  
🔗 ${res}
🔗 ${res}
🔗 ${res}
${getHiddenLink(imageUrl, "markdown")}`,
      {
        parse_mode: "markdown",
      }
    );
  })

})

pm.on('parserEnd', function (site, nProd) {
  console.log('End: fetched', nProd, 'from', site)
})

/* Add the products from CSV */
pm.parseCSV(fileInput)

/* Start watching prices */
pm.watchPrices(function (round) { // called once all the parsers retrieved all the products prices
  console.log('Starting', round + 'th', 'round')
})

/* gracefully shutdown */
process.on('SIGINT', function () {
  console.log('closing...')
  pm.close()
  setTimeout(function () {
    process.exit()
  }, 1000)
})
